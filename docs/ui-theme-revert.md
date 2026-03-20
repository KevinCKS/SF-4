# UI 테마 복원 가이드 (Dark Mint 대시보드)

참고용 대시보드 느낌(다크 네이비 + 민트 액센트 + 사이드바)을 적용한 뒤, **이전 흑백/상단 헤더 중심 UI로 되돌리려면** 아래 중 하나를 사용하세요.

## 방법 A: Git으로 되돌리기 (가장 확실)

테마 적용 **직전 커밋** 해시를 확인합니다.

```bash
git log --oneline -5
```

테마 관련 커밋 **이전**으로 파일만 복원:

```bash
git checkout <커밋해시> -- app/globals.css app/layout.tsx app/dashboard/layout.tsx components/layout/AppHeader.tsx
git rm components/layout/DashboardSidebar.tsx  # 신규 파일이었다면 삭제
# 이후 테마 작업에서 수정된 다른 파일이 있으면 동일하게 checkout
```

또는 **테마 전용 브랜치**를 쓰고 싶다면, 적용 전에 `main`에 태그를 남겨 두세요.

```bash
git tag ui-before-dark-mint
```

## 방법 B: 이번에 건드린 파일 목록 (수동/선택 복원)

- `app/globals.css` — 색·반경·차트 토큰 (파일 상단 THEME 주석 참고)
- `app/layout.tsx` — `defaultTheme`, `html` 의 `dark` 클래스, `body` `min-h-screen`
- `app/dashboard/layout.tsx` — 사이드바 + 본문 그리드
- `components/layout/AppHeader.tsx` — 대시보드에서 헤더 숨김
- `components/layout/DashboardSidebar.tsx` — 신규(복원 시 삭제하고 예전 레이아웃으로)
- `components/dashboard/DashboardFarmSelect.tsx` — `layout` prop (선택)

## 참고

- 디자인 레퍼런스는 **영리 목적의 그대로 복제가 아니라**, 색·레이아웃 **느낌**만 맞춘 구현입니다.
