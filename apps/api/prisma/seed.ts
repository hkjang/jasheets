import { PrismaClient, PermissionRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Cleanup
  await prisma.auditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.cell.deleteMany();
  await prisma.rowMeta.deleteMany();
  await prisma.colMeta.deleteMany();
  await prisma.sheet.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.version.deleteMany();
  await prisma.spreadsheet.deleteMany();
  await prisma.session.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.template.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  // Cleanup new admin tables
  await (prisma as any).aIModelConfig.deleteMany();
  await (prisma as any).promptTemplate.deleteMany();
  await (prisma as any).quota.deleteMany();
  await (prisma as any).sheetSession.deleteMany();
  await (prisma as any).aPIUsage.deleteMany();

  console.log('Cleanup finished.');


  // 1.8 Create System Roles
  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      description: 'System Administrator with full access',
      isSystem: true,
      permissions: { all: true }
    }
  });

  const editorRole = await prisma.role.create({
    data: {
      name: 'EDITOR',
      description: 'Can manage contents but not system settings',
      permissions: { manageSheets: true, manageUsers: false }
    }
  });

  const userRole = await prisma.role.create({
    data: {
      name: 'USER',
      isSystem: true,
      description: 'Standard user',
      permissions: { createSheets: true }
    }
  });

  console.log('Roles created.');

  // 2. Create Users
  const passwordHash = await bcrypt.hash('password123', 10);

  // Admin User
  const admin = await prisma.user.create({
    data: {
      email: 'admin@jasheets.com',
      password: passwordHash,
      name: 'Super Admin',
      isAdmin: true,
      roleId: adminRole.id,
      avatar: 'https://ui-avatars.com/api/?name=Super+Admin&background=0D8ABC&color=fff',
    },
  });
  console.log('Created Admin:', admin.email);

  // Regular Users
  const users = [];
  for (let i = 1; i <= 5; i++) {
    const user = await prisma.user.create({
      data: {
        email: `user${i}@example.com`,
        password: passwordHash,
        name: `User ${i}`,
        isAdmin: false,
        roleId: userRole.id,
        avatar: `https://ui-avatars.com/api/?name=User+${i}&background=random`,
      },
    });
    users.push(user);
    console.log(`Created User ${i}:`, user.email);
  }

  // 2.5 Create Notices & Templates
  await prisma.notice.createMany({
    data: [
      {
        title: 'Welcome to JaSheets',
        content: 'We hope you enjoy the new update!',
        type: 'INFO',
        active: true,
        authorId: admin.id
      },
      {
        title: 'Scheduled Maintenance',
        content: 'System will be down on Sunday at 2am.',
        type: 'WARNING',
        active: true,
        endDate: new Date(Date.now() + 86400000 * 7),
        authorId: admin.id
      }
    ]
  });

  await prisma.template.create({
    data: {
      name: 'Annual Budget',
      description: 'A comprehensive budget template for small businesses.',
      category: 'Finance',
      isPublic: true,
      data: {
        sheets: [
          {
            name: 'Budget',
            cells: {
              '0:0': { value: 'Year 2024 Budget' },
              '1:0': { value: 'Income' },
              '1:1': { value: 0 }
            }
          }
        ]
      }
    }
  });

  // 2.6 Create AI Model Configurations
  console.log('Creating AI Model Configurations...');
  await (prisma as any).aIModelConfig.createMany({
    data: [
      {
        name: 'GPT-4 수식 도우미',
        modelType: 'FORMULA_SUGGEST',
        provider: 'OPENAI',
        modelId: 'gpt-4-turbo-preview',
        version: '1.0',
        isActive: true,
        isDefault: true,
        config: { temperature: 0.3, maxTokens: 2048 }
      },
      {
        name: 'GPT-4 시트 생성기',
        modelType: 'SHEET_GENERATE',
        provider: 'OPENAI',
        modelId: 'gpt-4-turbo-preview',
        version: '1.0',
        isActive: true,
        isDefault: true,
        config: { temperature: 0.7, maxTokens: 4096 }
      },
      {
        name: 'Claude 3 데이터 분석',
        modelType: 'DATA_ANALYSIS',
        provider: 'ANTHROPIC',
        modelId: 'claude-3-sonnet-20240229',
        version: '1.0',
        isActive: true,
        isDefault: true,
        config: { temperature: 0.5, maxTokens: 4096 }
      },
      {
        name: 'Gemini 채팅 도우미',
        modelType: 'CHAT_ASSISTANT',
        provider: 'GEMINI',
        modelId: 'gemini-1.5-pro',
        version: '1.0',
        isActive: true,
        isDefault: true,
        config: { temperature: 0.7 }
      },
      {
        name: 'GPT-3.5 빠른 수식',
        modelType: 'FORMULA_SUGGEST',
        provider: 'OPENAI',
        modelId: 'gpt-3.5-turbo',
        version: '1.0',
        isActive: true,
        isDefault: false,
        config: { temperature: 0.3, maxTokens: 1024 }
      }
    ]
  });
  console.log('AI Model Configurations created.');


  // 2.7 Create Prompt Templates
  console.log('Creating Prompt Templates...');
  await (prisma as any).promptTemplate.createMany({
    data: [
      {
        name: '수식 도우미',
        category: 'FORMULA_GENERATION',
        description: '사용자가 원하는 계산을 수행하는 엑셀/시트 수식을 생성합니다.',
        content: `당신은 스프레드시트 수식 전문가입니다.
사용자의 요청에 맞는 수식을 생성해주세요.

사용자 요청: {{request}}
현재 셀 위치: {{cell}}
주변 데이터 컨텍스트: {{context}}

다음 형식으로 응답하세요:
1. 추천 수식: [수식]
2. 설명: [수식이 하는 일]
3. 사용 예시: [예시]`,
        variables: ['request', 'cell', 'context'],
        isActive: true,
        isDefault: true
      },
      {
        name: '데이터 분석 도우미',
        category: 'DATA_ANALYSIS',
        description: '선택된 데이터 범위에 대한 통계 분석 및 인사이트를 제공합니다.',
        content: `당신은 데이터 분석 전문가입니다.
다음 데이터를 분석하고 인사이트를 제공해주세요.

데이터 범위: {{range}}
데이터 미리보기:
{{data}}

분석 요청: {{analysisType}}

다음을 포함하여 분석해주세요:
- 기본 통계 (평균, 중앙값, 최대/최소)
- 주요 패턴 또는 이상치
- 실행 가능한 인사이트
- 시각화 추천`,
        variables: ['range', 'data', 'analysisType'],
        isActive: true,
        isDefault: true
      },
      {
        name: '차트 추천',
        category: 'CHART_SUGGESTION',
        description: '데이터에 가장 적합한 차트 유형과 설정을 추천합니다.',
        content: `당신은 데이터 시각화 전문가입니다.
주어진 데이터에 가장 적합한 차트를 추천해주세요.

데이터 유형: {{dataType}}
데이터 크기: {{rowCount}}행 x {{colCount}}열
데이터 샘플:
{{sample}}

시각화 목적: {{purpose}}

다음을 제안해주세요:
1. 추천 차트 유형 (우선순위순)
2. 각 차트가 적합한 이유
3. 권장 차트 설정
4. 대안 시각화 방법`,
        variables: ['dataType', 'rowCount', 'colCount', 'sample', 'purpose'],
        isActive: true,
        isDefault: true
      },
      {
        name: '에러 수정 도우미',
        category: 'AUTOMATION',
        description: '수식 에러를 분석하고 수정 방법을 제안합니다.',
        content: `당신은 스프레드시트 디버깅 전문가입니다.
다음 에러를 분석하고 해결책을 제시해주세요.

에러 유형: {{errorType}}
문제의 수식: {{formula}}
셀 위치: {{cell}}
에러 메시지: {{errorMessage}}

다음을 제공해주세요:
1. 에러 원인 분석
2. 수정된 수식
3. 향후 같은 에러 방지 팁`,
        variables: ['errorType', 'formula', 'cell', 'errorMessage'],
        isActive: true,
        isDefault: true
      },
      {
        name: '한글 문서 요약',
        category: 'CUSTOM',
        description: '긴 텍스트 데이터를 요약합니다.',
        content: `다음 텍스트를 간결하게 요약해주세요.

원본 텍스트:
{{text}}

요약 스타일: {{style}}
최대 길이: {{maxLength}}자

핵심 포인트를 불릿으로 정리하고, 마지막에 한 문장 요약을 추가해주세요.`,
        variables: ['text', 'style', 'maxLength'],
        isActive: true,
        isDefault: false
      },
      {
        name: '데이터 정제 도우미',
        category: 'CUSTOM',
        description: '데이터 정리 및 변환 작업을 도와줍니다.',
        content: `당신은 데이터 정제 전문가입니다.
다음 데이터를 정제하는 방법을 제안해주세요.

원본 데이터 샘플:
{{rawData}}

원하는 형식: {{targetFormat}}
특별 요구사항: {{requirements}}

다음을 제공해주세요:
1. 데이터 품질 이슈 식별
2. 권장 정제 단계
3. 사용할 수식 또는 함수
4. 자동화 가능한 부분`,
        variables: ['rawData', 'targetFormat', 'requirements'],
        isActive: true,
        isDefault: false
      }
    ]
  });
  console.log('Prompt Templates created.');


  // 3. Create Spreadsheets
  // Admin Project
  const adminSheet = await prisma.spreadsheet.create({
    data: {
      name: 'Quarterly Report (Admin)',
      ownerId: admin.id,
      isPublic: false,
      sheets: {
        create: [
          { name: 'Revenue', index: 0 },
          { name: 'Expenses', index: 1 },
        ]
      }
    },
    include: { sheets: true }
  });

  // Add some data to Admin Sheet
  if (adminSheet.sheets[0]) {
    await prisma.cell.create({
      data: {
        sheetId: adminSheet.sheets[0].id,
        row: 0,
        col: 0,
        value: 'Q1 Revenue',
        format: { bold: true }
      }
    });
    await prisma.cell.create({
      data: {
        sheetId: adminSheet.sheets[0].id,
        row: 0,
        col: 1,
        value: 150000,
        format: { type: 'currency' }
      }
    });
  }

  // Public Sheet by User 1
  const publicSheet = await prisma.spreadsheet.create({
    data: {
      name: 'Public Template',
      ownerId: users[0].id,
      isPublic: true, // Public access
      sheets: {
        create: { name: 'Template', index: 0 }
      }
    }
  });

  // Shared Project (User 1 owns, User 2 edits, User 3 views)
  const sharedSheet = await prisma.spreadsheet.create({
    data: {
      name: 'Team Project Alpha',
      ownerId: users[0].id,
      isPublic: false,
      sheets: {
        create: { name: 'Tasks', index: 0 }
      },
      permissions: {
        create: [
          { userId: users[1].id, role: PermissionRole.EDITOR },
          { userId: users[2].id, role: PermissionRole.VIEWER },
        ]
      }
    }
  });

  console.log('Seed finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
