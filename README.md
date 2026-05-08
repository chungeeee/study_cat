# StudyCat 🐱

데스크톱 오버레이 공부 타이머. 항상 위에 떠있는 투명 창에서 고양이가 같이 공부합니다.

## 기능

- **3가지 타이머 모드**
  - **뽀모도로**: 공부/휴식 시간 반복 (기본 25/5분)
  - **카운트다운**: 설정한 시간만큼 줄어듦
  - **스톱워치**: 0부터 자유 측정
- **오버레이 창**: 항상 위, 투명 배경, 다른 창 위에 떠있음
- **클릭 통과 모드** (`Alt+C`): 고양이를 통과해서 뒤 창 클릭 가능 (방해 안 됨)
- **숨기기/보이기** (`Alt+H` 또는 트레이 아이콘 클릭)
- **고양이 상태머신**: 공부 중엔 코딩/글쓰기/독서, 휴식엔 식빵/뒹굴/스트레칭, 완료 시 축하

## 실행

```bash
cd study_cat
npm install
npm start
```

## exe 빌드 (Windows)

포터블 빌드 (electron-packager):
```bash
npm run build
# dist/StudyCat-win32-x64/StudyCat.exe (포터블)
```

NSIS 설치파일 (electron-builder):
```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win nsis
# dist/StudyCat Setup <version>.exe
```
> Windows에서 symlink 권한이 없으면 winCodeSign 캐시 추출이 실패하므로
> 먼저 `npm run build`로 `dist/win-unpacked/`를 만든 뒤
> `--prepackaged dist/win-unpacked` 옵션으로 우회 가능.

## 단축키

| 단축키 | 동작 |
|--------|------|
| `Alt+C` | 클릭 통과 토글 |
| `Alt+H` | 창 숨기기/보이기 |
| 트레이 아이콘 클릭 | 숨기기/보이기 |

## 고양이 상태

`assets/cat/sheet1~4.png` 스프라이트 시트를 캔버스에 직접 그려 애니메이션.
`cat-window/sprites.js`에서 상태별 프레임을 정의함.

## 구조

```
study_cat/
├── package.json
├── main.js              # Electron 메인 (패널창/캣창/트레이/단축키)
├── preload.js           # 패널창 preload
├── preload-cat.js       # 캣창 preload
├── renderer/            # 패널 (타이머 UI)
│   ├── index.html
│   ├── style.css
│   └── timer.js
├── cat-window/          # 떠다니는 고양이 창
│   ├── cat.html
│   ├── cat.js           # 위치/AI/렌더 로직
│   └── sprites.js       # 스프라이트 프레임 매핑
└── assets/cat/          # sheet1~4.png, icon.png/ico
```
