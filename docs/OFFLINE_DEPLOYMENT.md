# JaSheets 오프라인 Docker 배포

이 번들은 인터넷이 차단된 Linux 서버에서 JaSheets Web과 API를 단일 컨테이너로
실행합니다. Nginx는 포함하지 않으며 기존 Ingress가 경로를 분기합니다.

## 1. 사전 준비

- x86_64 Linux 권장, 메모리 4GB 이상, 디스크 여유 공간 10GB 이상
- Docker Engine 24 이상 및 `docker compose` v2
- 접근 가능한 PostgreSQL 14 이상과 하나의 `POSTGRES_DSN`
- 클라이언트가 배포 서버의 HTTP 포트에 접근할 수 있는 내부망
- 운영 데이터 백업을 둘 별도 디스크

인터넷이 되는 빌드 PC에서 릴리스의 `.tar.gz`와 `.sha256`을 내려받아
SHA-256을 검증한 뒤 USB 또는 승인된 내부 전송 수단으로 서버에 복사합니다.

```bash
sha256sum -c jasheets-offline-VERSION.tar.gz.sha256
tar -xzf jasheets-offline-VERSION.tar.gz
cd jasheets-offline-VERSION
```

## 2. 환경설정

첫 실행은 `.env` 템플릿을 만들고 중단됩니다.

```bash
./install.sh
```

`.env`에서 필수로 변경할 값은 하나입니다.

- `POSTGRES_DSN`: JaSheets 전용 PostgreSQL 접속 문자열

JWT 서명키와 OIDC 설정 암호화 키는 최초 실행 시 `jasheets_state` 볼륨에
자동 생성되며 컨테이너를 교체해도 유지됩니다. 이 볼륨도 백업해야 합니다.

Ingress는 `/`를 호스트의 Web bind(기본 `127.0.0.1:3000`)로 보내고,
`/api`와 `/socket.io`를 API bind(기본 `127.0.0.1:4000`)로 보내십시오.

`/api/mcp`도 API bind로 전달하면 동일 이미지에서 Streamable HTTP MCP를
사용할 수 있습니다. 도구와 인증 설정은 [MCP_SERVER.md](./MCP_SERVER.md)를
참조하십시오.

## 3. 설치 및 확인

```bash
./install.sh
docker compose --env-file .env -f docker-compose.offline.yml ps
docker compose --env-file .env -f docker-compose.offline.yml logs -f app
```

단일 App 컨테이너는 시작 전에 Prisma migration을 자동 적용한 뒤 Web과 API를
함께 실행합니다. 두 bind 포트는 Ingress 호스트에서만 접근하게 유지하십시오.

## 4. 백업과 복구

업그레이드 전 논리 백업을 생성합니다.

```bash
pg_dump "$POSTGRES_DSN" -Fc > jasheets-backup.dump
```

복구 시 App을 중지하고 외부 PostgreSQL에 dump를 적용합니다.

```bash
docker compose --env-file .env -f docker-compose.offline.yml stop app
pg_restore --dbname="$POSTGRES_DSN" --clean --if-exists < jasheets-backup.dump
docker compose --env-file .env -f docker-compose.offline.yml up -d
```

## 5. 오프라인 업그레이드

새 번들을 별도 디렉터리에 풀고 기존 `.env`를 복사합니다. 데이터베이스 백업 후
새 디렉터리에서 `./install.sh`를 실행합니다. Compose 프로젝트 이름이
`jasheets`로 고정되어 기존 볼륨을 유지하면서 컨테이너만 새 이미지로 교체하고
필요한 migration을 적용합니다.

롤백은 코드 이미지 교체만으로 끝나지 않을 수 있습니다. migration이 적용된 뒤에는
반드시 업그레이드 직전 백업을 복구한 다음 이전 번들의 Compose를 실행하십시오.

## 6. 운영 명령

```bash
# 상태
docker compose --env-file .env -f docker-compose.offline.yml ps

# 로그
docker compose --env-file .env -f docker-compose.offline.yml logs --tail=200 app

# 재시작
docker compose --env-file .env -f docker-compose.offline.yml restart

# 중지(데이터 볼륨 보존)
docker compose --env-file .env -f docker-compose.offline.yml down
```

`down -v`는 자동 생성된 JWT/OIDC 암호화 키 볼륨을 삭제하므로 운영 환경에서
사용하지 마십시오. 외부 PostgreSQL 백업과 `jasheets_state` 볼륨을 함께 보관하십시오.

## 7. 릴리스 번들 생성

인터넷 연결과 Docker가 있는 검증된 빌드 머신에서 다음 명령을 실행합니다.

```bash
./scripts/build-offline-release.sh VERSION
./scripts/publish-offline-release.sh VERSION
```

첫 명령은 `dist/releases/`에 이미지 포함 archive와 체크섬을 만들고, 두 번째
명령은 같은 자산을 SemVer GitHub Release(예: `v0.1.1`)에 게시합니다.
Docker image도 동일하게 `jasheets:v0.1.1` 형식을 사용하며 commit SHA는
`release-manifest.txt`의 추적 정보로만 남습니다.
