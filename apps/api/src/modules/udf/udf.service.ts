import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as vm from 'vm';

// UDF Types
export interface UserDefinedFunction {
    id: string;
    spreadsheetId: string;
    name: string;
    description?: string;
    code: string;
    parameters: ParameterDef[];
    returnType: 'number' | 'string' | 'boolean' | 'array' | 'any';
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ParameterDef {
    name: string;
    type: 'number' | 'string' | 'boolean' | 'array' | 'any';
    required: boolean;
    defaultValue?: any;
    description?: string;
}

export interface UDFExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
    executionTime: number;
}

export interface CreateUDFDto {
    spreadsheetId: string;
    name: string;
    description?: string;
    code: string;
    parameters: ParameterDef[];
    returnType: 'number' | 'string' | 'boolean' | 'array' | 'any';
}

export interface UpdateUDFDto {
    name?: string;
    description?: string;
    code?: string;
    parameters?: ParameterDef[];
    returnType?: 'number' | 'string' | 'boolean' | 'array' | 'any';
}

// Security: Blacklisted globals and functions
const BLOCKED_GLOBALS = [
    'process', 'require', 'module', 'exports', '__dirname', '__filename',
    'global', 'globalThis', 'eval', 'Function', 'setTimeout', 'setInterval',
    'setImmediate', 'clearTimeout', 'clearInterval', 'clearImmediate',
    'Buffer', 'XMLHttpRequest', 'fetch', 'WebSocket',
];

// Safe globals for sandbox
const SAFE_GLOBALS = {
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    encodeURIComponent,
    decodeURI,
    decodeURIComponent,
    console: {
        log: () => { }, // Disable console in production
        warn: () => { },
        error: () => { },
    },
};

@Injectable()
export class UDFService {
    private readonly logger = new Logger(UDFService.name);
    private readonly functionRegistry = new Map<string, UserDefinedFunction>();

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a new UDF
     */
    async createUDF(userId: string, dto: CreateUDFDto): Promise<UserDefinedFunction> {
        // Validate function name
        if (!/^[A-Z][A-Z0-9_]*$/i.test(dto.name)) {
            throw new BadRequestException('함수 이름은 영문자로 시작하고 영문자, 숫자, 밑줄만 포함할 수 있습니다.');
        }

        // Validate code security
        this.validateCode(dto.code);

        // Test execution
        const testResult = this.executeUDF(dto.code, dto.parameters.map(p => p.defaultValue ?? 0));
        if (!testResult.success) {
            throw new BadRequestException(`함수 검증 실패: ${testResult.error}`);
        }

        // Store in database (using SystemConfig as a workaround if no UDF model exists)
        const udf: UserDefinedFunction = {
            id: this.generateId(),
            spreadsheetId: dto.spreadsheetId,
            name: dto.name.toUpperCase(),
            description: dto.description,
            code: dto.code,
            parameters: dto.parameters,
            returnType: dto.returnType,
            createdById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Register in memory
        const key = `${dto.spreadsheetId}:${udf.name}`;
        this.functionRegistry.set(key, udf);

        // Persist (store as JSON in system config for now)
        await this.persistUDF(udf);

        return udf;
    }

    /**
     * Get all UDFs for a spreadsheet
     */
    async getUDFs(spreadsheetId: string): Promise<UserDefinedFunction[]> {
        const udfs: UserDefinedFunction[] = [];

        // Load from memory registry
        for (const [key, udf] of this.functionRegistry.entries()) {
            if (key.startsWith(`${spreadsheetId}:`)) {
                udfs.push(udf);
            }
        }

        // Load from storage if not in memory
        if (udfs.length === 0) {
            const stored = await this.loadUDFs(spreadsheetId);
            for (const udf of stored) {
                const key = `${spreadsheetId}:${udf.name}`;
                this.functionRegistry.set(key, udf);
                udfs.push(udf);
            }
        }

        return udfs;
    }

    /**
     * Get a specific UDF
     */
    async getUDF(spreadsheetId: string, name: string): Promise<UserDefinedFunction | null> {
        const key = `${spreadsheetId}:${name.toUpperCase()}`;

        if (this.functionRegistry.has(key)) {
            return this.functionRegistry.get(key)!;
        }

        const udfs = await this.loadUDFs(spreadsheetId);
        const udf = udfs.find(u => u.name === name.toUpperCase());

        if (udf) {
            this.functionRegistry.set(key, udf);
        }

        return udf || null;
    }

    /**
     * Update a UDF
     */
    async updateUDF(spreadsheetId: string, name: string, dto: UpdateUDFDto): Promise<UserDefinedFunction> {
        const udf = await this.getUDF(spreadsheetId, name);
        if (!udf) {
            throw new BadRequestException('함수를 찾을 수 없습니다.');
        }

        if (dto.code) {
            this.validateCode(dto.code);

            const testParams = (dto.parameters || udf.parameters).map(p => p.defaultValue ?? 0);
            const testResult = this.executeUDF(dto.code, testParams);
            if (!testResult.success) {
                throw new BadRequestException(`함수 검증 실패: ${testResult.error}`);
            }
        }

        const updatedUDF: UserDefinedFunction = {
            ...udf,
            name: dto.name?.toUpperCase() || udf.name,
            description: dto.description ?? udf.description,
            code: dto.code ?? udf.code,
            parameters: dto.parameters ?? udf.parameters,
            returnType: dto.returnType ?? udf.returnType,
            updatedAt: new Date(),
        };

        const oldKey = `${spreadsheetId}:${name.toUpperCase()}`;
        const newKey = `${spreadsheetId}:${updatedUDF.name}`;

        this.functionRegistry.delete(oldKey);
        this.functionRegistry.set(newKey, updatedUDF);

        await this.persistUDF(updatedUDF);

        return updatedUDF;
    }

    /**
     * Delete a UDF
     */
    async deleteUDF(spreadsheetId: string, name: string): Promise<void> {
        const key = `${spreadsheetId}:${name.toUpperCase()}`;
        this.functionRegistry.delete(key);

        await this.prisma.systemConfig.deleteMany({
            where: {
                key: { startsWith: `udf:${spreadsheetId}:${name.toUpperCase()}` },
            },
        });
    }

    /**
     * Execute a UDF with arguments
     */
    executeUDF(code: string, args: any[]): UDFExecutionResult {
        const startTime = Date.now();

        try {
            // Create sandboxed context
            const sandbox = {
                ...SAFE_GLOBALS,
                __args__: args,
                __result__: undefined,
            };

            // Create context with global access blocked
            const context = vm.createContext(sandbox);

            // Wrap user code in a function
            const wrappedCode = `
        (function() {
          ${BLOCKED_GLOBALS.map(g => `var ${g} = undefined;`).join('\n')}
          
          const userFunction = ${code};
          
          if (typeof userFunction !== 'function') {
            throw new Error('코드는 함수를 반환해야 합니다.');
          }
          
          __result__ = userFunction.apply(null, __args__);
        })();
      `;

            // Execute with timeout
            const script = new vm.Script(wrappedCode);
            script.runInContext(context, {
                timeout: 1000, // 1 second timeout
                displayErrors: true,
            });

            const executionTime = Date.now() - startTime;

            return {
                success: true,
                result: sandbox.__result__,
                executionTime,
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                executionTime,
            };
        }
    }

    /**
     * Execute a named UDF from registry
     */
    async executeNamedUDF(spreadsheetId: string, name: string, args: any[]): Promise<UDFExecutionResult> {
        const udf = await this.getUDF(spreadsheetId, name);
        if (!udf) {
            return {
                success: false,
                error: `함수 '${name}'을(를) 찾을 수 없습니다.`,
                executionTime: 0,
            };
        }

        // Validate arguments
        for (let i = 0; i < udf.parameters.length; i++) {
            const param = udf.parameters[i];
            if (param.required && (args[i] === undefined || args[i] === null)) {
                return {
                    success: false,
                    error: `필수 매개변수 '${param.name}'이(가) 없습니다.`,
                    executionTime: 0,
                };
            }
        }

        return this.executeUDF(udf.code, args);
    }

    /**
     * Validate UDF code for security issues
     */
    private validateCode(code: string): void {
        // Check for blocked patterns
        const blockedPatterns = [
            /require\s*\(/,
            /import\s+/,
            /process\./,
            /global\./,
            /globalThis\./,
            /eval\s*\(/,
            /Function\s*\(/,
            /new\s+Function\s*\(/,
            /\bfetch\s*\(/,
            /XMLHttpRequest/,
            /WebSocket/,
            /__proto__/,
            /constructor\s*\[/,
        ];

        for (const pattern of blockedPatterns) {
            if (pattern.test(code)) {
                throw new BadRequestException('보안 위반: 코드에 허용되지 않는 패턴이 포함되어 있습니다.');
            }
        }

        // Basic syntax check
        try {
            new vm.Script(`(${code})`);
        } catch (error) {
            throw new BadRequestException(`구문 오류: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Persist UDF to storage
     */
    private async persistUDF(udf: UserDefinedFunction): Promise<void> {
        const key = `udf:${udf.spreadsheetId}:${udf.name}`;

        await this.prisma.systemConfig.upsert({
            where: { key },
            create: {
                key,
                value: JSON.stringify(udf),
                description: `UDF: ${udf.name} for spreadsheet ${udf.spreadsheetId}`,
            },
            update: {
                value: JSON.stringify(udf),
            },
        });
    }

    /**
     * Load UDFs from storage
     */
    private async loadUDFs(spreadsheetId: string): Promise<UserDefinedFunction[]> {
        const configs = await this.prisma.systemConfig.findMany({
            where: {
                key: { startsWith: `udf:${spreadsheetId}:` },
            },
        });

        return configs.map(c => JSON.parse(c.value) as UserDefinedFunction);
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `udf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get built-in helper functions documentation
     */
    getBuiltInHelpers(): { name: string; description: string; example: string }[] {
        return [
            {
                name: 'Math',
                description: 'JavaScript Math 객체의 모든 함수 사용 가능',
                example: 'function(x) { return Math.sqrt(x); }',
            },
            {
                name: 'Array Methods',
                description: 'map, filter, reduce 등 배열 메서드 사용 가능',
                example: 'function(arr) { return arr.reduce((a, b) => a + b, 0); }',
            },
            {
                name: 'String Methods',
                description: '문자열 조작 메서드 사용 가능',
                example: 'function(s) { return s.toUpperCase(); }',
            },
        ];
    }
}
