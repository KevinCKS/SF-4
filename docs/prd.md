# Smartfarm Web Service - 제품 요구사항 정의서(PRD)

> 프로젝트의 전반적인 방향과 기능을 구체화한 문서입니다. 실제 개발에 바로 활용할 수 있는 수준으로 구성합니다.

---

## 1. 주요 기능

### 1) 이메일/비밀번호 로그인 및 회원가입

- Supabase Auth를 활용해 사용자 인증 기능 제공
- **기능**: 회원가입, 로그인, 로그아웃, 비밀번호 재설정(이메일 링크)
- **연동**: `users` / `profiles` 테이블과 Supabase Auth 1:1 연동

---

### 2) 농장/구역 관리(CRUD)

- 농장(온실·재배 구역)의 **생성(Create), 조회(Read), 수정(Update), 삭제(Delete)** 지원
- **필드**

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `id` | uuid | PK, 자동 생성 |
| `user_id` | uuid | 소유 사용자 (Supabase Auth 연동) |
| `name` | text | 농장/구역 이름 |
| `description` | text | 설명 |
| `location` | text | 위치 |
| `area_sqm` | numeric | 면적(㎡) |
| `created_at` | timestamptz | 생성일 |
| `updated_at` | timestamptz | 수정일 |

- 한 사용자가 여러 농장/구역 보유 가능 (users 1 : N farms).

---

### 3) 센서 데이터 검색, 필터, 정렬 기능

- **검색**: 농장명·구역명, 센서명(또는 장비 ID)으로 검색 가능
- **필터링**
  - 센서 타입: 온도 / 습도 / 조도 / CO2 / 토양수분 등
  - 농장/구역: 특정 농장 또는 구역만
  - 기간: 일자/시간 범위 (오늘, 최근 7일, 사용자 지정)
- **정렬**
  - 수집일시순: 최신순 / 과거순
  - 센서 타입순
  - 값 기준: 높은순 / 낮은순
- **데이터 소스**: `sensor_readings` (및 `sensors` 메타정보)

---

### 4) AI 환경 분석 및 권장 사항 기능

- 사용자가 **자연어로 질문**하거나 **버튼 클릭**으로 AI가 농장/센서 데이터를 분석해 인사이트와 재배 개선 권장 사항 제공
- **입력 예**: "이번 주 1번 구역 온도 추이 어떻게 돼?"
- **출력 예**
  - 기간별 온도/습도 요약, 이상 구간 안내
  - 환기·가습·차광 등 재배 환경 개선 제안
- **연동**: AI SDK + Google Gemini API; 분석 시 해당 구역·기간의 `sensor_readings` 등 DB 데이터를 컨텍스트로 전달

---

### 5) AI 요약 및 분석 기능

- 버튼 클릭 한 번으로 AI가 전체 농장/센서 데이터를 분석해 요약 결과 제공
- **일일 요약**: 당일 구역별 센서 요약, 임계치 초과 이벤트 요약
- **주간 요약**: 지난 7일 환경 추이, 이상 구간 및 완료율·진행 상황 분석

---

### 6) MQTT 통신 및 하드웨어 연동

- **MQTT Broker**: HiveMQ Cloud 사용
- **디바이스**: 아두이노 우노 R4 WiFi 보드와 MQTT로 실시간 양방향 통신
- **역할**
  - **수신**: 아두이노에서 발행하는 센서 값(온도, 습도, EC, pH)을 MQTT 구독하여 대시보드에 표시 및 DB 저장
  - **발행**: 웹에서 액추에이터 제어 명령을 MQTT로 발행하여 아두이노에서 수신·실행
- **센서 (4종)**: 온도, 습도, EC, pH — 대시보드에 **게이지**와 **라인 차트**로 표시
- **액추에이터 (4종)**: 식물성장 LED, Pump, FAN 2개 — 대시보드에 **제어 버튼**으로 ON/OFF(또는 설정값) 전송

---

## 2. 화면 구성

| 순번 | 화면 | 설명 | 포함 기능 |
|------|------|------|------------|
| 1 | **로그인/회원가입** | 사용자 인증 및 계정 관리 | 로그인, 회원가입, 비밀번호 재설정 |
| 2 | **대시보드(메인)** | 농장·센서·액추에이터 현황 및 제어 | 아래 대시보드 구성 참고 |
| 3 | **농장/구역 상세** | 단일 농장(구역) 관리 | 해당 구역 CRUD, 연동 센서 목록, 기간별 센서 차트/테이블, AI 분석 호출 |
| 4 | **이후 확장** | 통계 및 분석 전용 | 주간·월간 활동량, 구역별/센서별 통계, 완료율·이상 구간 시각화 |

#### 대시보드(메인) 구성

- **메인 화면**: 대시보드(Dashboard)를 기본 레이아웃으로 구성한다.
- **센서 표시 (온도, 습도, EC, pH)**
  - **게이지**: 각 센서의 현재 값을 게이지(Gauge)로 표시
  - **라인 차트**: 각 센서의 시계열 데이터를 라인 차트(Line Chart)로 표시 (실시간 또는 최근 구간)
- **액추에이터 제어**
  - **제어 버튼**으로 다음 4종을 제어
    - 식물성장 LED
    - Pump
    - FAN 1
    - FAN 2
  - 버튼 클릭 시 MQTT로 제어 명령 발행 → 아두이노 우노 R4 WiFi에서 수신 후 동작
- **기타**: 농장/구역 선택, 검색·필터·정렬, AI 요약/질의 진입점 등

- **공통**: 로딩/빈 상태/오류 상태 UI 제공, 한글 오류 메시지 (프로젝트 규칙 준수).

---

## 3. 사용 기술

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router) — 저장소는 16.x (`package.json` 기준) |
| 언어 | TypeScript (strict 권장) |
| 스타일링 | Tailwind CSS |
| UI 컴포넌트 | Shadcn/ui |
| 인증/DB | Supabase (Auth, DB 등) |
| AI 연동 | AI SDK (Google Gemini API) |
| **MQTT Broker** | **HiveMQ Cloud** |
| **하드웨어** | **아두이노 우노 R4 WiFi** (MQTT 클라이언트, 센서 수집·액추에이터 제어) |
| 린트 | ESLint (Next/TS 규칙 기반) |

---

## 4. 데이터 구조(Supabase 활용)

### 4.1 테이블 개요

| 테이블 | 설명 |
|--------|------|
| **users / profiles** | 사용자 프로필 관리 (Supabase Auth와 1:1 연동) |
| **farms** | 농장/구역 정보 (사용자별 소유), users 테이블과 연결 |
| **sensors** | 센서(장비) 메타정보, farms에 소속 |
| **sensor_readings** | 센서별 시계열 측정값 |
| **alert_settings** (확장) | 임계치 및 알림 설정 |
| **alert_logs** (확장) | 알림 발생 이력 |

### 4.2 스키마 요약 (개발 참고)

- **users / profiles**
  - `id` (uuid, PK) — `auth.users.id`와 동일
  - `email`, `display_name`, `created_at`, `updated_at` 등

- **farms**
  - `id`, `user_id` (FK → users), `name`, `description`, `location`, `area_sqm`, `created_at`, `updated_at`
  - RLS: `user_id = auth.uid()` 기준 접근 제어

- **sensors**
  - `id`, `farm_id` (FK → farms), `name`, `sensor_type` (temperature, humidity, light, co2, soil_moisture 등), `unit`, `created_at`, `updated_at`
  - RLS: 해당 farm의 user_id로 접근 제어

- **sensor_readings**
  - `id`, `sensor_id` (FK → sensors), `value` (numeric), `recorded_at` (timestamptz)
  - 인덱스: `(sensor_id, recorded_at)` 권장
  - RLS: sensor → farm → user_id로 접근 제어

- **alert_settings** (확장)
  - `id`, `farm_id` 또는 `sensor_id`, `min_value`, `max_value`, `notify_email`, `is_active`, `created_at`, `updated_at`

- **alert_logs** (확장)
  - `id`, `alert_setting_id`, `sensor_reading_id`, `message`, `created_at`

### 4.3 관계 요약

- `users` 1 : N `farms`
- `farms` 1 : N `sensors`
- `sensors` 1 : N `sensor_readings`
- (확장) `farms` / `sensors`와 `alert_settings`, `alert_logs` 연동

### 4.4 MQTT 연동 (HiveMQ Cloud)

- **Broker**: HiveMQ Cloud (연결 정보는 환경 변수로 관리)
- **센서 토픽**: 아두이노 → 웹. 온도/습도/EC/pH 값 발행, 웹에서 구독 후 대시보드 게이지·라인 차트 반영 및 DB 저장
- **액추에이터 토픽**: 웹 → 아두이노. 식물성장 LED, Pump, FAN 1, FAN 2 제어 명령 발행, 아두이노에서 구독 후 GPIO/릴레이 제어
- **토픽 구조**: 개발 단계에서 `farm_id` 또는 디바이스 ID 기반 토픽 규칙 정의 (예: `smartfarm/{device_id}/sensors`, `smartfarm/{device_id}/actuators`)

---

## 5. 문서 비고

- **대상**: Smartfarm Web Service (스마트팜 웹 서비스)
- **우선순위 제안**: 인증 → 농장 CRUD → MQTT 연동(HiveMQ Cloud) 및 아두이노 R4 WiFi 연동 → 대시보드(게이지·라인 차트·액추에이터 버튼) → 센서 메타/읽기·검색·필터·정렬 → AI 요약/질의 → 알림(확장) 순으로 구현 가능

---

## 6. 배포

- **배포**: Vercel에서 GitHub를 통한 CI/CD를 적용한다.
  - 저장소를 Vercel에 연결한 뒤, main(또는 지정 브랜치)에 푸시 시 자동 빌드·배포
  - 환경 변수(Supabase, HiveMQ Cloud, Gemini API 키 등)는 Vercel 프로젝트 설정에서 등록
  - 프리뷰 배포: PR별 자동 프리뷰 URL 생성 (선택)
