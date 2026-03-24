/**
 * 센서 카드 내부 패널(알림·AI·필터 등) 공통 표면 클래스 — 레이아웃·톤 통일용
 */

/** 민트 톤 보더·그라데이션 면·바깥 글로우+깊은 그림자로 입체감을 준다. */
export const DASHBOARD_CARD_DEPTH_CLASS =
  "rounded-xl border border-primary/35 bg-gradient-to-br from-card/96 via-card/88 to-card/80 shadow-[0_12px_44px_-14px_rgba(45,212,191,0.24),0_6px_22px_-8px_rgba(0,0,0,0.52)] ring-1 ring-inset ring-white/[0.09] backdrop-blur-md"

export const SENSOR_SECTION_SURFACE_CLASS = `${DASHBOARD_CARD_DEPTH_CLASS} p-4 sm:p-5`
