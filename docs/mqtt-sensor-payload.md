# MQTT → DB 저장 규칙 (단계 5.3)

서버가 MQTT 메시지를 받으면 `sensors` / `sensor_readings` 에 저장할 수 있다.  
이때 **요청 세션이 없으므로** `SUPABASE_SERVICE_ROLE_KEY` 로만 쓴다(서버 환경 변수).

## `farm_id` 를 넣는 방법 (둘 중 하나)

1. **토픽 경로에 UUID** (농장마다 토픽을 나누고 싶을 때)  
   - 예: `smartfarm/<farm-uuid>/sensors/temperature`  
   - 예: `smartfarm/<farm-uuid>/sensors/all`

2. **토픽에는 farm 없음** (고정 토픽 + 페이로드로 구분 — 기본 UI/테스트와 동일)  
   - 토픽: `smartfarm/sensors/temperature` | `humidity` | `ec` | `ph` 또는 `smartfarm/sensors/all`  
   - JSON 본문에 **`farm_id`** (또는 `farmId`) 에 유효한 UUID 를 넣는다. **이 값이 필수.**

## JSON 본문 (권장)

- **단일 센서 토픽** (`…/temperature` 등)  
  - `value` 숫자 **또는** `temperature` / `humidity` / `ec` / `ph` 키에 숫자  
  - 선택: `timestamp` | `recorded_at` | `recordedAt` (없으면 서버 시각)

```json
{
  "farm_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "value": 24.5,
  "timestamp": "2026-03-21T12:00:00.000Z"
}
```

- **`…/sensors/all`**  
  - 위와 같이 `farm_id` 필요(토픽에 없으면 본문 필수)  
  - `temperature`, `humidity`, `ec`, `ph` 중 **들어온 키만** 각각 한 건씩 저장

## DB 쪽 정책

- 해당 `farm_id` 가 `farms` 에 없으면 저장하지 않는다.
- `sensors` 행은 **(farm_id, sensor_type)** 당 최초 수신 시 자동 생성(이름·단위는 코드의 기본값).
- 중복 삽입 완화를 위해 `docs/sql/sensors-unique-farm-sensor-type.sql` 의 유니크 인덱스 실행을 권장한다.
