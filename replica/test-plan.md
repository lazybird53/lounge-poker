# 통신 검증 — 2026-10-15

최종 회귀 구성: 72개(기존 70개 + 손상된 저장 세션 복구/방 전환 채팅 응답 격리 2개). 전체 실행 `npm test`. 두 신규 회귀는 수정 전 실패와 수정 후 통과 확인.

## 후속 사용성

check-usability.js: 빈 닉네임 오류/초점과 Enter 생성, 잘못된 코드 오류/공백·소문자 정규화/Enter 참가, 봇 추가 갱신 후 키보드 초점, 닫힌 채팅 새 메시지 표시/열면 해제, 650ms 지연 주입 중 전송 표시와 다음 초안 유지. 5개 흐름 통과, pageerror 0. 입력값을 기억하는 기능 때문에 첫 테스트에서 빈 이름 조건을 명시하지 않아 대기가 실패했으며, 이름을 비운 뒤 다시 검증함.

## 모바일 후속 검증 (같은 날짜)

- Chrome 모바일 에뮬레이션 / 터치 입력. 화면: 320×568, 390×844, 844×390, 568×320, 768×1024.
- check-mobile-experience.js: 게임 갱신 중 실제 채팅 input DOM/포커스/선택 영역 유지. 한글 composition 도중에도 새 메시지와 게임 갱신을 차단하지 않음.
- VisualViewport 높이 440/320을 주입해 입력창·전송 버튼·하단 바가 겹치지 않는지 좌표 검사. 실제 OS 키보드를 띄운 검증은 아님.
- 권한 거절 주입 후 재시도, 권한 대기 취소 뒤 늦게 반환된 마이크 트랙 종료, pagehide/pageshow 이벤트 주입 후 마이크 종료와 재참가 버튼 확인.
- check-mobile-voice.js: 가상 마이크 두 탭에서 실제 WebRTC audio 수신. 화면 회전/채팅 중 수신 패킷 증가, 음성 poll 실패 주입 후 연결 정리·재참가 연결 통과.
- 위 브라우저 검사 pageerror 0. 실패 주입의 의도된 400 응답은 정상 응답으로 위장하지 않음. 회귀 테스트 70/70 통과.
- 캡처: output/playwright/mobile-keyboard-geometry.png, mobile-tested.png.

남은 실기기 검사: Android/iOS 소프트키보드와 한글 IME, Safari, 실제 OS 앱 전환·화면 잠금·통화 중단, 블루투스 입출력 전환, 외부 LTE/Wi-Fi 음질/TURN. 연결된 실제 휴대폰이 없어 완료로 처리하지 않음.

| Case | 검증 | 방법 | 결과 |
| --- | --- | --- | --- |
| F01-H1 | 같은 방 채팅 및 HTML 문자열 안전 표시 | Chrome 6탭 | 통과 |
| F01-E1 | 실패 시 입력 유지 | HTTP 400 응답 주입 | 통과 |
| F01-N1 | 빈 입력/장문/과다 전송 | voice.test.mjs | 통과 |
| F02-H1 | 6인 각 5개 peer 연결 및 오디오 수신 | WebRTC getStats / 가상 마이크 | 통과 |
| F02-H2 | 음소거 및 나가기 | 송신 트랙 enabled와 peer closed 확인 | 통과 |
| F02-E1 | 390px 레이아웃 | screenshot / overflow 확인 | 통과 |
| F02-N1 | 방/세션 격리 및 잘못된 신호 | voice.test.mjs / HTTP 보안 테스트 | 통과 |
| F02-E2 | 실제 기기/외부망/음질/권한 거절 | 실측 필요 | 미검증 |

자동 회귀 테스트 65/65. 재현 스크립트 output/playwright/check-communications.js.
브라우저는 Chrome 및 fake-device/fake-ui-for-media-stream 옵션. 사람의 마이크나 음질을 테스트했다는 뜻이 아님.
최종 실행에서 6인 각각 5개 상대의 audio inbound-rtp packetsReceived가 모두 양수(16~76). 게임 시작 후 행동 선택과 채팅 병행 통과. pageerror 0. 콘솔의 400은 의도한 실패 주입, 정리 후 state 401은 테스트 방 삭제에 따른 응답이며 별도 기록.
CLI 실행: Chrome을 `output/playwright/voice.config.json` 설정으로 열고 `run-code --filename output/playwright/check-communications.js`. 설정은 browser.launchOptions.args에 `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, browser.contextOptions.permissions에 `microphone`. 테스트 외의 실제 마이크를 활성화하지 않음.
스크린샷 output/playwright/communications-mobile.png. 전체 접근성 자동 스캔 미실행.
