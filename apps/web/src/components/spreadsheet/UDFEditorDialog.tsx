'use client';

import { useState, useEffect } from 'react';
import { boundedFetch } from '@/lib/api-client';
import styles from './UDFEditorDialog.module.css';

interface ParameterDef {
    name: string;
    type: 'number' | 'string' | 'boolean' | 'array' | 'any';
    required: boolean;
    defaultValue?: any;
}

interface UDFData {
    name: string;
    description: string;
    code: string;
    parameters: ParameterDef[];
    returnType: 'number' | 'string' | 'boolean' | 'array' | 'any';
}

interface TestResult {
    success: boolean;
    result?: any;
    error?: string;
    executionTime: number;
}

interface UDFEditorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (udf: UDFData) => void;
    spreadsheetId: string;
    existingUDF?: UDFData;
    apiUrl?: string;
}

const DEFAULT_CODE = `function(value) {
  // 여기에 함수 로직을 작성하세요
  return value * 2;
}`;

export default function UDFEditorDialog({
    isOpen,
    onClose,
    onSave,
    spreadsheetId,
    existingUDF,
    apiUrl = 'http://localhost:4000/api',
}: UDFEditorDialogProps) {
    const [udf, setUdf] = useState<UDFData>({
        name: '',
        description: '',
        code: DEFAULT_CODE,
        parameters: [{ name: 'value', type: 'any', required: true }],
        returnType: 'any',
    });
    const [testArgs, setTestArgs] = useState('10');
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (existingUDF) {
            setUdf(existingUDF);
        } else {
            setUdf({
                name: '',
                description: '',
                code: DEFAULT_CODE,
                parameters: [{ name: 'value', type: 'any', required: true }],
                returnType: 'any',
            });
        }
        setTestResult(null);
        setError(null);
    }, [existingUDF, isOpen]);

    const handleAddParameter = () => {
        setUdf({
            ...udf,
            parameters: [
                ...udf.parameters,
                { name: `param${udf.parameters.length + 1}`, type: 'any', required: false },
            ],
        });
    };

    const handleRemoveParameter = (index: number) => {
        setUdf({
            ...udf,
            parameters: udf.parameters.filter((_, i) => i !== index),
        });
    };

    const handleParameterChange = (index: number, field: keyof ParameterDef, value: any) => {
        const newParams = [...udf.parameters];
        newParams[index] = { ...newParams[index], [field]: value };
        setUdf({ ...udf, parameters: newParams });
    };

    const handleTest = async () => {
        try {
            const args = JSON.parse(`[${testArgs}]`);
            const token = localStorage.getItem('auth_token');

            const response = await boundedFetch(`${apiUrl}/udf/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    code: udf.code,
                    args,
                }),
            });

            const result = await response.json();
            setTestResult(result);
        } catch (err) {
            setTestResult({
                success: false,
                error: err instanceof Error ? err.message : '테스트 실패',
                executionTime: 0,
            });
        }
    };

    const handleSave = async () => {
        if (!udf.name.trim()) {
            setError('함수 이름을 입력하세요.');
            return;
        }

        if (!/^[A-Z][A-Z0-9_]*$/i.test(udf.name)) {
            setError('함수 이름은 영문자로 시작하고 영문자, 숫자, 밑줄만 사용할 수 있습니다.');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const token = localStorage.getItem('auth_token');
            const response = await boundedFetch(`${apiUrl}/udf/spreadsheet/${spreadsheetId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(udf),
            });

            if (response.ok) {
                onSave(udf);
                handleClose();
            } else {
                const data = await response.json();
                throw new Error(data.message || '저장에 실패했습니다.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setError(null);
        setTestResult(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>
                        <span>⚡</span>
                        {existingUDF ? '함수 수정' : '사용자 정의 함수 만들기'}
                    </h2>
                    <button className={styles.closeBtn} onClick={handleClose}>
                        ×
                    </button>
                </div>

                <div className={styles.content}>
                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>함수 이름</label>
                            <input
                                type="text"
                                value={udf.name}
                                onChange={(e) => setUdf({ ...udf, name: e.target.value.toUpperCase() })}
                                placeholder="MY_FUNCTION"
                            />
                            <div className={styles.hint}>
                                시트에서 =MY_FUNCTION() 형태로 사용됩니다
                            </div>
                        </div>
                        <div className={styles.field}>
                            <label>반환 타입</label>
                            <select
                                value={udf.returnType}
                                onChange={(e) => setUdf({ ...udf, returnType: e.target.value as any })}
                            >
                                <option value="any">Any</option>
                                <option value="number">Number</option>
                                <option value="string">String</option>
                                <option value="boolean">Boolean</option>
                                <option value="array">Array</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label>설명</label>
                        <input
                            type="text"
                            value={udf.description}
                            onChange={(e) => setUdf({ ...udf, description: e.target.value })}
                            placeholder="이 함수가 하는 일을 설명하세요"
                        />
                    </div>

                    <div className={styles.paramsSection}>
                        <h3>매개변수</h3>
                        {udf.parameters.map((param, i) => (
                            <div key={i} className={styles.paramRow}>
                                <input
                                    type="text"
                                    value={param.name}
                                    onChange={(e) => handleParameterChange(i, 'name', e.target.value)}
                                    placeholder="매개변수 이름"
                                />
                                <select
                                    value={param.type}
                                    onChange={(e) => handleParameterChange(i, 'type', e.target.value as any)}
                                >
                                    <option value="any">Any</option>
                                    <option value="number">Number</option>
                                    <option value="string">String</option>
                                    <option value="boolean">Boolean</option>
                                    <option value="array">Array</option>
                                </select>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                    <input
                                        type="checkbox"
                                        checked={param.required}
                                        onChange={(e) => handleParameterChange(i, 'required', e.target.checked)}
                                    />
                                    필수
                                </label>
                                {i > 0 && (
                                    <button className={styles.removeBtn} onClick={() => handleRemoveParameter(i)}>
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                        <button className={styles.addParamBtn} onClick={handleAddParameter}>
                            + 매개변수 추가
                        </button>
                    </div>

                    <div className={styles.field}>
                        <label>함수 코드</label>
                        <textarea
                            className={styles.codeEditor}
                            value={udf.code}
                            onChange={(e) => setUdf({ ...udf, code: e.target.value })}
                            placeholder="function(arg1, arg2) { return arg1 + arg2; }"
                        />
                        <div className={styles.hint}>
                            JavaScript 함수를 작성하세요. Math, Array 메서드 등 사용 가능합니다.
                        </div>
                    </div>

                    <div className={styles.testSection}>
                        <h3>🧪 테스트</h3>
                        <div className={styles.testRow}>
                            <input
                                type="text"
                                className={styles.testInput}
                                value={testArgs}
                                onChange={(e) => setTestArgs(e.target.value)}
                                placeholder="인자 (예: 10, 20)"
                            />
                            <button className={styles.testBtn} onClick={handleTest}>
                                실행
                            </button>
                        </div>
                        {testResult && (
                            <div className={`${styles.testResult} ${testResult.success ? styles.success : styles.error}`}>
                                {testResult.success ? (
                                    <>
                                        <strong>결과:</strong> {JSON.stringify(testResult.result)}
                                        <span style={{ marginLeft: '12px', opacity: 0.7 }}>
                                            ({testResult.executionTime}ms)
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <strong>오류:</strong> {testResult.error}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={handleClose}>
                        취소
                    </button>
                    <button
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={isSaving || !udf.name.trim()}
                    >
                        {isSaving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}
