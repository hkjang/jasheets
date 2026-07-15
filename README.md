# JaSheets - 웹 기반 스프레드시트 서비스

Google Sheets와 유사한 웹 기반 스프레드시트 서비스입니다. Next.js 15 프론트엔드와 NestJS 백엔드로 구축되었으며, 실시간 협업, 수식 엔진, AI 기능을 지원합니다.

프로젝트의 장기 제품 원칙과 목표는 [JaSheets Goal](docs/GOAL.md), 단계별 실행 계획은 [Product Roadmap](docs/PRODUCT_ROADMAP.md)을 참고하세요.

## 기술 스택

### 프론트엔드

- **Next.js 15** - App Router, RSC/CSR 혼합
- **TypeScript** - 타입 안전성
- **TailwindCSS** - 스타일링
- **Canvas API** - 고성능 스프레드시트 렌더링

### 백엔드

- **NestJS** - 모듈형 API 서버
- **Prisma** - 타입 안전한 ORM
- **PostgreSQL** - 관계형 데이터베이스
- **Socket.IO** - 실시간 WebSocket 통신
- **Redis** - 캐싱 및 세션 관리

### 패키지

- **@jasheets/shared** - 공통 타입 및 유틸리티
- **@jasheets/formula-engine** - 수식 파서 및 계산 엔진
- **@jasheets/crdt** - Yjs 기반 실시간 협업

## 시작하기

### 사전 요구사항

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-repo/jasheets.git
cd jasheets

# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env
```

### Docker 서비스 실행

#### 📦 개발 환경 (권장)

```bash
# PostgreSQL만 실행 (필수)
pnpm db:up

# 또는 직접 실행
cd docker
docker compose -f docker-compose.dev.yml up -d
```

#### 🚀 운영 환경 (모든 서비스)

```bash
# 환경 변수 설정
cd docker
cp .env.prod.example .env

# 모든 서비스 실행
pnpm db:up:prod
```

#### 서비스 목록

| 서비스     | 포트       | 개발 | 운영 |
| ---------- | ---------- | :--: | :--: |
| PostgreSQL | 5432       |  ✅  |  ✅  |
| Redis      | 6379       | 선택 |  ✅  |
| MinIO S3   | 9000, 9001 |  ❌  |  ✅  |
| ChromaDB   | 8000       |  ❌  |  ✅  |

### 데이터베이스 마이그레이션

```bash
cd apps/api
npx prisma migrate dev
```

### 개발 서버 실행

```bash
# 모든 앱 동시 실행
pnpm dev

# 또는 개별 실행
cd apps/web && npm run dev   # http://localhost:3000
cd apps/api && npm run start:dev  # http://localhost:4000
```

## 프로젝트 구조

```
jasheets/
├── apps/
│   ├── web/                 # Next.js 15 프론트엔드
│   │   └── src/
│   │       ├── app/         # App Router 페이지
│   │       ├── components/  # React 컴포넌트
│   │       │   └── spreadsheet/
│   │       ├── hooks/       # 커스텀 훅
│   │       └── types/       # TypeScript 타입
│   └── api/                 # NestJS 백엔드
│       └── src/
│           ├── modules/     # 기능 모듈
│           │   ├── auth/
│           │   ├── sheets/
│           │   └── collaboration/
│           └── prisma/      # 데이터베이스
├── packages/
│   ├── shared/              # 공통 타입
│   ├── formula-engine/      # 수식 엔진
│   └── crdt/                # CRDT 협업
├── docker/                  # Docker 설정
└── package.json
```

## 핵심 기능

### ✅ 구현됨

- [x] Canvas 기반 스프레드시트 렌더링
- [x] 셀 선택 및 편집
- [x] 키보드 네비게이션
- [x] 수식 엔진 (SUM, AVERAGE, IF 등)
- [x] 서식 도구바 (Bold, Italic, 정렬)
- [x] Undo/Redo
- [x] JWT 인증
- [x] WebSocket 실시간 협업
- [x] 권한 관리 시스템

### 🔜 향후 구현

- [ ] AI 수식 생성
- [ ] 차트 및 피벗 테이블
- [ ] 버전 히스토리
- [ ] 오프라인 지원 (PWA)
- [ ] 코멘트 및 채팅

## API 엔드포인트

### 인증

- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/refresh` - 토큰 갱신
- `POST /api/auth/logout` - 로그아웃

### 스프레드시트

- `GET /api/sheets` - 목록 조회
- `POST /api/sheets` - 생성
- `GET /api/sheets/:id` - 상세 조회
- `PUT /api/sheets/:id` - 수정
- `DELETE /api/sheets/:id` - 삭제

### 셀

- `PUT /api/sheets/sheet/:sheetId/cell/:row/:col` - 셀 업데이트
- `PUT /api/sheets/sheet/:sheetId/cells` - 배치 업데이트

## 라이센스

MIT License
