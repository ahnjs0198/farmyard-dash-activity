# Farmyard Dash — Discord Activity

흑백 픽셀 동물농장 러너를 Discord 안에서 실행하고, 서버별 리더보드(Top 10)를 보여 주는 Activity.
게임 파일, API, DB가 전부 Cloudflare Workers 하나에 올라간다.

```
public/          게임 화면 (index.html, style.css, 폰트, 빌드된 app.js)
src/game.js      게임 본체
src/app.js       Discord 로그인 + 점수 전송 + 리더보드 표시
src/worker.js    API: /api/config, /api/token, /api/leaderboard, /api/score
schema.sql       D1 테이블
```

## 0. 준비

```bash
npm install
npx wrangler login          # 브라우저에서 Cloudflare 계정 승인
```

## 1. Discord 앱 만들기

1. https://discord.com/developers/applications → **New Application** → 이름 `Farmyard Dash`
2. **OAuth2** 탭
   - **Client ID**를 복사한다 (공개해도 되는 값).
   - **Reset Secret**을 눌러 **Client Secret**을 복사한다 (절대 공개 금지).
   - Redirects에 `https://127.0.0.1` 하나를 추가한다 (Activity에서는 쓰이지 않지만, 비어 있으면 OAuth가 거절되는 경우가 있다).
3. **Activities → Settings**에서 **Enable Activities**를 켠다.

## 2. Cloudflare에 DB 만들고 배포

```bash
npx wrangler d1 create farmyard-dash
```

출력된 `database_id`와 위에서 복사한 Client ID를 `wrangler.jsonc`에 넣는다.

```jsonc
"database_id": "출력된 ID",
...
"DISCORD_CLIENT_ID": "복사한 Client ID"
```

```bash
npm run db:init                                   # 테이블 생성 (원격 D1)
npx wrangler secret put DISCORD_CLIENT_SECRET     # Client Secret 붙여넣기
npm run deploy                                    # 빌드 + 배포
```

배포가 끝나면 `https://farmyard-dash.<계정>.workers.dev` 주소가 나온다.
브라우저로 열면 오프라인 모드로 게임이 바로 돌아가는지 확인할 수 있다.

## 3. URL Mapping 연결

Developer Portal → **Activities → URL Mappings**

| PREFIX | TARGET |
|---|---|
| `/` | `farmyard-dash.<계정>.workers.dev` (https:// 없이) |

게임, 폰트, API가 모두 같은 주소라 매핑은 이 한 줄이면 된다.
외부 CDN을 전혀 쓰지 않아서 Discord의 CSP 차단에 걸리지 않는다.

## 4. 실행

1. Developer Portal → **Installation**에서 Install Link로 앱을 내 테스트 서버에 설치한다.
2. 그 서버의 음성 채널이나 텍스트 채널에서 **Activities(로켓 아이콘)** → Farmyard Dash.
3. 처음 한 번 권한 허용 창이 뜬다 (`identify`: 이름과 ID만 읽는다).
4. 한 판 끝날 때마다 점수가 올라가고 리더보드가 갱신된다.

인증(verification) 전에는 개발자 본인과 Developer Portal **App Testers**에 등록한 사람만 실행할 수 있다.
친구들과 하려면 App Testers에 추가하자.

## 동작 메모

- 리더보드 단위: 서버(guild)별. DM/그룹 DM에서는 그 대화방별.
- 점수 검증: 서버가 Discord에 토큰 주인을 직접 물어 이름을 정한다. 다른 사람 이름으로 점수를 못 올린다.
  초당 56점을 넘는 점수와 2.5초 안에 연달아 보낸 점수는 거절한다. 완벽한 치트 방지는 아니다.
- 플레이어당 최고 점수와 플레이 횟수만 저장한다. 게임 오버 1번 = D1 쓰기 1행.
- 오프라인 모드(일반 브라우저): 최고 점수는 그 기기 localStorage에만 남는다.

## 로컬 테스트

```bash
npx wrangler d1 execute farmyard-dash --local --file=schema.sql
npm run dev        # http://localhost:8787
```

## 서버1로 옮길 때

API는 `src/worker.js` 한 파일이고 DB는 SQLite 스키마 그대로다.
Node 서버(예: Hono + better-sqlite3)로 같은 4개 경로를 구현하고, Cloudflare Tunnel에
`farm.jaesolahn.com → localhost:<포트>`를 추가한 뒤 URL Mapping의 TARGET만 바꾸면 된다.
D1 데이터는 `npx wrangler d1 export farmyard-dash --remote --output=scores.sql`로 내보낸다.
