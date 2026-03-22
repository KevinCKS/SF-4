# Smartfarm Web Service - 구현 절차 가이드

> `docs/prd.md`를 기반으로 단계별로 구현할 수 있도록 정리한 절차입니다. 순서대로 하나씩 진행하면 됩니다.

---

## 전체 흐름 요약

| 단계 | 내용 | 산출물 |
|------|------|--------|
| **0** | 프로젝트 기반 점검 | Next.js(App Router) 16.x, TS, Tailwind, Shadcn/ui, Supabase 클라이언트 |
| **1** | Supabase 설정 및 인증 | profiles, Auth, 로그인/회원가입/비밀번호 재설정 |
| **2** | 농장/구역 CRUD | farms 테이블, 목록·상세·추가·수정·삭제 |
| **3** | MQTT 연동 기반 | HiveMQ Cloud, 토픽 규칙, 구독/발행 유틸 |
| **4** | 대시보드 UI | 레이아웃, 센서 게이지·라인 차트, 액추에이터 버튼 |
| **5** | 센서·DB 연동 | sensors/sensor_readings, MQTT→DB, 검색·필터·정렬 |
| **6** | AI 요약/분석 | AI SDK + Gemini, 일일/주간 요약, 자연어 질의 |
| **7** | 알림(확장) | alert_settings, alert_logs, 임계치 알림 |
| **8** | 배포 | Vercel + GitHub CI/CD, 환경 변수, 프리뷰 배포 |

---

## 단계 0: 프로젝트 기반 점검

- [ ] **0.1** Next.js (App Router) 프로젝트 확인. `package.json`의 Next 버전과 일치하는지 점검 (현재 저장소는 16.x 기준)
- [ ] **0.2** TypeScript strict 설정 확인 (`tsconfig.json`)
- [ ] **0.3** Tailwind CSS 설정 확인
- [ ] **0.4** Shadcn/ui 설치 및 필요한 컴포넌트 추가 (Button, Card, Input, Form 등)
- [ ] **0.5** Supabase 프로젝트 생성 후 `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정
- [ ] **0.6** Supabase 클라이언트 초기화 코드 작성 (브라우저/서버 공용 또는 분리)
- [ ] **0.7** 프로젝트 규칙 적용 확인 (`.cursor/rules/project-rule.mdc`): 로딩/빈 상태/오류 UI, 한글 메시지

**완료 기준**: 로컬에서 `npm run dev` 실행 가능, Supabase 연결 테스트 가능

---

## 단계 1: Supabase 설정 및 인증 (PRD §1.1, §2 화면1)

- [ ] **1.1** Supabase 대시보드에서 **profiles** 테이블 생성  
  - `id` (uuid, PK, `auth.users.id` 참조), `email`, `display_name`, `created_at`, `updated_at`  
  - Auth 가입 시 프로필 자동 생성 트리거(선택)
- [ ] **1.2** Auth 설정: 이메일/비밀번호 사용 활성화
- [ ] **1.3** 로그인 페이지 구현 (`/login`): 이메일·비밀번호 입력, Supabase `signInWithPassword`, 로그인 후 리다이렉트
- [ ] **1.4** 회원가입 페이지 구현 (`/signup`): 이메일·비밀번호 입력, `signUp`, 이메일 확인 정책에 맞춰 처리
- [ ] **1.5** 비밀번호 재설정: `resetPasswordForEmail` 호출 페이지 또는 링크
- [ ] **1.6** 로그아웃: `signOut` 후 로그인 페이지로 이동
- [ ] **1.7** 인증 상태에 따른 라우트 보호: 미로그인 시 로그인 페이지로 리다이렉트 (미들웨어 또는 레이아웃에서 체크)
- [ ] **1.8** 공통: 로딩/빈 상태/오류 UI 및 한글 오류 메시지 적용 (PRD §2 공통)

**완료 기준**: 회원가입 → 로그인 → 대시보드(또는 메인) 진입 → 로그아웃 흐름 동작

---

## 단계 2: 농장/구역 관리 CRUD (PRD §1.2, §4.2)

- [ ] **2.1** Supabase에 **farms** 테이블 생성  
  - `id` (uuid, PK), `user_id` (uuid, FK → auth.users), `name`, `description`, `location`, `area_sqm`, `created_at`, `updated_at`  
  - RLS: `user_id = auth.uid()` 로 본인 데이터만 접근
- [ ] **2.2** farms용 TypeScript 타입 정의 (프로젝트 내 `types` 또는 도메인 폴더)
- [ ] **2.3** 농장 목록 조회: `farms` 테이블에서 `user_id`로 필터해 목록 API/서버 액션 또는 클라이언트 조회
- [ ] **2.4** 농장 추가: 입력 폼(이름, 설명, 위치, 면적) → INSERT 후 목록 갱신
- [ ] **2.5** 농장 상세 조회: `id`로 단일 farm 조회 (RLS로 본인 것만)
- [ ] **2.6** 농장 수정: 상세 폼에서 수정 후 UPDATE
- [ ] **2.7** 농장 삭제: 확인 후 DELETE (연관 sensors/sensor_readings 정책에 따라 CASCADE 또는 사전 삭제)
- [ ] **2.8** 농장 목록/상세 화면 라우트 구성 (예: `/dashboard/farms`, `/dashboard/farms/[id]`) 및 로딩/빈 상태/오류 UI

**완료 기준**: 한 사용자 기준으로 농장 생성·목록·상세·수정·삭제가 모두 동작

---

## 단계 3: MQTT 연동 기반 (PRD §1.6, §3, §4.4)

- [ ] **3.1** HiveMQ Cloud 계정 생성, 브로커 클러스터 생성 후 호스트/포트/사용자명/비밀번호 확인  
  - (선택) WebSocket 포트 사용 시 웹에서 직접 MQTT 연결 가능 여부 확인
- [ ] **3.2** 환경 변수 추가: `NEXT_PUBLIC_MQTT_BROKER_URL`(또는 호스트/포트/WS URL), `MQTT_USERNAME`, `MQTT_PASSWORD` (클라이언트 노출 최소화)
- [ ] **3.3** 토픽 규칙 정의 및 문서화 (PRD §4.4): `smartfarm/{farm_id}/sensors`, `smartfarm/{farm_id}/actuators`  
  - 센서 payload 예시: `{ temperature, humidity, ec, ph, timestamp }`  
  - 액추에이터 payload 예시: `{ led, pump, fan1, fan2 }` (ON/OFF 또는 0/1)
- [ ] **3.4** 브라우저에서 MQTT 사용 시: MQTT over WebSocket 클라이언트 라이브러리 선택 (예: `mqtt`, `paho-mqtt`) 및 연결 유틸 함수 작성 (연결/구독/발행/재연결)
- [ ] **3.5** 서버에서만 MQTT 사용 시: Node용 MQTT 클라이언트로 API Route 또는 Server Action에서 발행/구독 처리, 웹은 REST/Server Action으로만 연동
- [ ] **3.6** 현재 선택된 농장(farm_id) 또는 디바이스 ID에 맞는 토픽 구독/발행이 동작하는지 테스트 (예: MQTT 클라이언트 도구로 메시지 발행 후 웹에서 수신 확인)

**완료 기준**: 웹 앱에서 HiveMQ Cloud에 연결해 지정 토픽 구독·발행이 가능

---

## 단계 4: 대시보드 UI (PRD §2 대시보드 구성, §1.6)

- [ ] **4.1** 메인 화면을 **대시보드** 레이아웃으로 구성 (예: `/dashboard` 또는 `/` 인증 후)  
  - 상단: 로고/농장 선택/사용자 메뉴(로그아웃 등)  
  - 본문: 센서 영역 + 액추에이터 영역
- [ ] **4.2** **센서 영역** (PRD: 온도, 습도, EC, pH)  
  - **게이지**: 각 센서의 현재 값을 게이지(Gauge)로 표시 (초기값 0 또는 `--` 등)  
  - **라인 차트**: 4개 센서 시계열을 라인 차트(Line Chart)로 표시 (Chart.js, Recharts, Tremor 등)  
  - 차트는 최근 N분/1시간 등 고정 구간 또는 실시간 구독 데이터로 갱신
- [ ] **4.3** **액추에이터 영역** (PRD: 식물성장 LED, Pump, FAN 1, FAN 2)  
  - 각 4종 **제어 버튼** (ON/OFF 토글 또는 개별 ON·OFF 버튼)  
  - 클릭 시 MQTT로 해당 토픽에 제어 명령 발행 → 아두이노 우노 R4 WiFi에서 수신·동작
- [ ] **4.4** 농장이 여러 개일 경우: 농장 선택 드롭다운/탭에 따라 해당 farm_id의 토픽만 구독/표시
- [ ] **4.5** 로딩/빈 상태(연결 전, 데이터 없음)/오류 상태 UI 및 한글 메시지 적용 (PRD §2 공통)

**완료 기준**: 대시보드에 게이지 4개·라인 차트·액추에이터 버튼 4개가 보이고, 버튼 클릭 시 MQTT 발행까지 동작

---

## 단계 5: 센서 메타·DB 연동 및 검색/필터/정렬 (PRD §1.3, §4)

- [ ] **5.1** Supabase에 **sensors** 테이블 생성  
  - SQL 스크립트: `docs/sql/sensors-table.sql` → Supabase **SQL Editor**에서 실행 (선행: `farms` 테이블 존재)  
  - `id`, `farm_id` (FK → farms, `ON DELETE CASCADE`), `name`, `sensor_type`, `unit`, `created_at`, `updated_at`  
  - RLS: `farms.user_id = auth.uid()` 인 농장에 속한 센서만 CRUD
- [ ] **5.2** **sensor_readings** 테이블 생성  
  - SQL 스크립트: `docs/sql/sensor-readings-table.sql` → Supabase **SQL Editor**에서 실행 (선행: `sensors`)  
  - `id`, `sensor_id` (FK → sensors, `ON DELETE CASCADE`), `value`, `recorded_at`, `created_at`, `updated_at`  
  - 인덱스: `(sensor_id, recorded_at desc)`  
  - RLS: sensor → farm → 본인(`auth.uid()`)만 CRUD
- [ ] **5.3** 대시보드에서 MQTT로 수신한 센서 값을 해당 farm의 sensors/sensor_readings에 **저장**  
  - 구현: `lib/mqtt/sensorPersist.ts` + `lib/supabaseServiceRole.ts` (서버 MQTT 콜백에서 호출)  
  - 환경 변수: `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 클라이언트 노출 금지)  
  - 정책: **첫 수신 시** 해당 farm에 `sensor_type` 별 `sensors` 행을 자동 생성(기본 4종 이름·단위는 코드 고정). farm 생성 시 시드하는 방식은 선택 사항.  
  - 페이로드·토픽 규칙: `docs/mqtt-sensor-payload.md` 참고
- [ ] **5.4** 라인 차트 데이터를 DB에서 조회하도록 연동: `sensor_readings`에서 기간·sensor_id로 조회 후 차트에 반영
- [ ] **5.5** **검색**: 농장명·구역명·센서명(또는 장비 ID)으로 검색 가능한 UI/API
- [ ] **5.6** **필터**: 센서 타입(온도/습도/EC/pH 등), 농장/구역, 기간(오늘/최근 7일/사용자 지정) 선택
- [ ] **5.7** **정렬**: 수집일시순(최신/과거), 센서 타입순, 값 기준(높은순/낮은순)
- [ ] **5.8** 농장/구역 상세 화면: 해당 구역 CRUD(단계 2), 연동 센서 목록, 기간별 센서 차트/테이블, AI 분석 진입점 (PRD §2 화면3)

**완료 기준**: MQTT 수신 값이 DB에 쌓이고, 대시보드·상세 화면에서 검색·필터·정렬된 센서 데이터를 확인 가능

---

## 단계 6: AI 요약 및 분석 (PRD §1.4, §1.5, §3)

- [ ] **6.1** AI SDK 설치 및 Google Gemini API 연동 (환경 변수: `GOOGLE_GENERATIVE_AI_API_KEY` 또는 해당 키 변수명)
- [ ] **6.2** **일일 요약**: 당일 구역별 센서 요약, 임계치 초과 이벤트 요약  
  - 해당 일의 sensor_readings를 조회해 AI에 컨텍스트로 전달, 요약 문단 생성 후 UI에 표시
- [ ] **6.3** **주간 요약**: 지난 7일 환경 추이, 이상 구간·완료율·진행 상황 분석  
  - 최근 7일 데이터를 AI에 전달, 요약/분석 결과 표시
- [ ] **6.4** **자연어 질의**: 사용자 입력(예: "이번 주 1번 구역 온도 추이 어떻게 돼?")을 AI에 전달하고, 해당 구역·기간 DB 데이터를 컨텍스트로 붙여 답변 생성 (PRD §1.4)
- [ ] **6.5** 대시보드 또는 상세 화면에 "AI 요약" 버튼·입력창 배치 및 로딩/오류 UI(한글 메시지) 처리

**완료 기준**: 일일/주간 요약 및 자연어 질의가 동작하고, 결과가 한글로 표시됨

---

## 단계 7: 알림(확장) (PRD §4.1 alert_settings, alert_logs)

- [ ] **7.1** **alert_settings** 테이블: farm_id 또는 sensor_id, min_value, max_value, notify_email, is_active, created_at, updated_at
- [ ] **7.2** **alert_logs** 테이블: alert_setting_id, sensor_reading_id, message, created_at
- [ ] **7.3** 센서 값 수신 시(MQTT→DB 저장 후 또는 주기 배치) 임계치 비교 후 초과 시 alert_logs 삽입, (선택) 이메일 발송
- [ ] **7.4** 알림 설정 화면: 농장/센서별 상한·하한 설정, 알림 ON/OFF
- [ ] **7.5** 알림 이력 조회 화면 (목록/필터)

**완료 기준**: 임계치 설정 후 해당 조건에서 알림 로그 생성(및 선택적으로 이메일) 동작

---

## 단계 8: 배포 (PRD §6. 배포)

- [ ] **8.1** GitHub 저장소에 프로젝트 푸시 (이미 있다면 최신 반영)
- [ ] **8.2** Vercel 대시보드에서 해당 GitHub 저장소 연결, 프로젝트 생성
- [ ] **8.3** 배포 브랜치 설정 (기본: `main` 또는 지정 브랜치). 푸시 시 자동 빌드·배포되는지 확인
- [ ] **8.4** Vercel 프로젝트 설정에서 **환경 변수** 등록: Supabase URL/Anon Key, HiveMQ Cloud 연결 정보, Gemini API 키 등 (프로덕션·프리뷰 구분 가능)
- [ ] **8.5** (선택) PR별 **프리뷰 배포** 활성화 시 PR마다 자동으로 프리뷰 URL 생성되는지 확인
- [ ] **8.6** 배포 URL에서 로그인·대시보드 등 핵심 흐름 동작 확인

**완료 기준**: main(또는 설정 브랜치) 푸시 시 Vercel에서 자동 빌드·배포되고, 프로덕션 환경에서 서비스 동작 확인 가능

---

## 리팩터링 기록 (API Route Handler 공통화)

> Route Handler에서 반복되던 **Supabase 세션 검증**과 **500 응답 포맷**을 한곳으로 모은다.

| 항목 | 설명 |
|------|------|
| **위치** | `lib/api/server.ts` |
| **`requireUser()`** | `createSupabaseServerClient()` + `getUser()` 후 미인증이면 `401` JSON(`UNAUTHORIZED_JSON_MESSAGE`) |
| **`isRequireUserSuccess()`** | 결과 타입 가드로 `supabase`/`user` 사용 가능 여부 판별 |
| **`toInternalErrorResponse()`** | `catch` 블록에서 공통 500 JSON |
| **적용 파일** | `app/api/farms/route.ts`, `app/api/farms/[id]/route.ts`, `app/api/mqtt/*/route.ts` |

**추가 리팩터링 후보(선택)**: 인증 페이지(로그인·회원가입 등) 폼/에러 처리 공통화, `lib/supabaseClient.ts` 환경 변수 누락 시 사용자 안내 UI.

---

## 진행 시 참고 사항

- **순서**: PRD §5 우선순위 제안에 맞춰 **인증(1) → 농장 CRUD(2) → MQTT(3) → 대시보드(4) → 센서·DB·검색/필터/정렬(5) → AI(6) → 알림(7) → 배포(8)** 순으로 진행하는 것을 권장합니다.
- **단계 내**: 0.1 → 0.2 → … 처럼 작은 항목을 순서대로 체크하면 누락을 줄일 수 있습니다.
- **프로젝트 규칙** (`.cursor/rules/project-rule.mdc`): 함수형 컴포넌트·화살표 함수·파스칼 케이스 파일명·한글 주석/JSDoc·ESLint 준수, 로딩/빈 상태/오류 UI 및 한글 오류 메시지를 일관되게 적용하세요.
- **문서**: 토픽 규칙·API 스펙·환경 변수 목록은 `docs/` 또는 README에 정리해 두면 유지보수에 유리합니다.

특정 단계(예: "단계 1부터 구현해 줘")를 요청하시면 해당 단계의 구체적인 코드/파일 구조까지 이어서 안내할 수 있습니다.
