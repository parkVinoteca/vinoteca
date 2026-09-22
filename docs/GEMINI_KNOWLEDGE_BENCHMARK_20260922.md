# Gemini 웹 검색 없는 와인 인식 — 11장 실측

2026-09-22 · Preview `67f6f0b` · 운영 미반영

## 조건과 결과

사용자 제공 사진 11장(서로 다른 와인 10종)을 실제 테이스팅 화면에서 시험했다. HEIC는 JPEG로 변환하고 모든 사진에서 「写真全体」를 선택했다. 앱의 일반 이미지 압축은 적용했다. Gemini 3.5 Flash-Lite만 1회씩 호출했고, 웹 검색·Claude·재시도는 없었다. 정답 대조용 공식 자료 조사는 모델 응답 이후 별도로 했으며 모델에 전달하지 않았다. 테이스팅 기록은 저장하지 않았다.

| 사진 | 와인 | Gemini | 서버 응답 완료 | 대조 결과 |
|---|---|---:|---:|---|
| IMG_5365.HEIC | Pichon Longueville Comtesse de Lalande 2008 | 1.853초 | 5.4초 | 생산자·품종 누락 |
| IMG_5344.HEIC | Mouton Cadet Réserve Margaux 2022 (dark) | 1.721초 | 3.9초 | 품종 오답: Petit Verdot |
| IMG_4964.HEIC | Twenty Rows Reserve Cabernet Sauvignon 2022 | 1.633초 | 3.8초 | 기본 정보 일치 |
| IMG_4705.HEIC | Ridge Lytton Springs 2012 | 1.758초 | 4.2초 | 기본 정보·4품종 일치 |
| IMG_4639.HEIC | Mouton Cadet Réserve Margaux 2022 (bright) | 3.024초 | 5.7초 | 같은 품종 오답 반복 |
| IMG_4634.HEIC | Tortue & Grue / T&G | 1.801초 | 3.4초 | 식별 불가, HTTP422 |
| IMG_5117.JPG | Garzón Tannat Reserva 2023 | 2.316초 | 4.1초 | 기본 정보 일치 |
| IMG_5296.JPG | Secondo Marco Valpolicella Classico 2021 | 1.948초 | 3.8초 | 기본 정보·4품종 일치 |
| IMG_5253.JPG | San Giusto a Rentennano Percarlo 2019 | 2.058초 | 3.7초 | 기본 정보 일치 |
| IMG_5216.JPG | Capannelle Solare 2013 | 1.716초 | 3.7초 | 기본 정보·2품종 일치 |
| IMG_5014.JPG | Ricasoli Rocca Guicciarda 2021 | 1.666초 | 3.7초 | 공식 자료끼리 품종 불일치 |

Gemini 평균 1.954초, 중앙값 1.801초, 범위 1.633~3.024초. 서버 응답 완료 평균 4.13초, 범위 3.4~5.7초. 서버 시간은 압축·Storage 업로드·화면 렌더링 전부를 포함한 사용자의 전체 대기 시간이 아니다.

입력 합계 15,466 / 출력 합계 2,254토큰. 무료 프로젝트 등급 내 API 계산 비용 **0엔**(청구서 확인 금액 아님, Storage·호스팅 제외). HTTP200 10회, HTTP422 1회. 200을 정확도 성공으로 세지 않았다. 기본 정보 대조 6장, 명확한 품종 오답 2장(같은 와인), 누락 1장, 식별 불가 1장, 공식 출처 충돌 1장이다. 이 작은 표본의 비율을 전체 서비스 정확도로 일반화하지 않는다. 빈티지별 수치·양조·향미까지 검증한 시험도 아니다.

## 핵심 발견

- **빠른 응답도 틀릴 수 있다.** 어두운/밝은 Mouton Cadet 사진 모두 Petit Verdot를 제시했다. 공식 2022 구성은 Cabernet Sauvignon, Merlot, Cabernet Franc다. AI의 자신감이나 같은 답의 반복만으로 정확성을 보장할 수 없다.
- **모르는 와인이 오래 걸리는 것은 아니다.** Tortue & Grue는 1.801초 만에 식별 불가로 끝났다. 라벨의 문자는 보이는데 앱이 사진을 더 밝게 찍으라고 안내한다. OCR 불가와 제품 지식 부족을 구별해야 한다. 뒷라벨이 없으면 유료 검색도 답을 못 찾을 수 있다.
- **앱 검증에도 결함이 있다.** Pichon은 이름·빈티지·산지는 나오지만 생산자·품종이 누락됐다. 오프라인 재현에서 `Grand Cru Classé`의 `grand`를 상품명에 요구하는 규칙이 정상 후보를 버릴 수 있음을 확인했다. 실제 호출 원문을 수집하지 않았으므로 이것이 이번 누락의 확정 원인이라고 단정하지 않는다.
- **유료 검색도 출처 판단이 필요하다.** Ricasoli 2021 영문 공식 PDF는 Sangiovese 90%/Merlot 10%, 이탈리아 공식 페이지는 Sangiovese 90%/Merlot 5%/Canaiolo 5%다. 이번 모델 답은 영문 PDF와 맞지만 검증 완료로 처리하지 않았다.

## 적용할 판단 기준

1. Gemini 1회로 사진 문자와 와인 지식을 함께 받는다. 이름·생산자·빈티지와 원문을 분리하여, 제품을 몰라도 읽힌 문자를 남긴다.
2. 검수 자료 또는 라벨에 직접 적힌 품종은 우선한다. 빈티지 민감 블렌딩, 품종이 라벨에 없는 미검수 와인, 이름 충돌은 추가 검증 대상이다. AI 자신감 하나로 분기하지 않는다.
3. 부족한 항목만 생산자/와인명/빈티지 텍스트로 검색한다. 사진 재분석과 긴 문서 전체 반환을 피하고 검증된 결과만 재사용한다. 클로드/유료 Gemini 중 어떤 경로가 더 정확하고 저렴한지는 별도 비교 실측 전 확정하지 않는다.
4. 유료 전환은 응답의 부족·모순에 따른다. 단순히 5초/10초를 넘겼다는 이유로 유료 모델을 동시에 호출하지 않는다.
5. 임시 UX 기준은 8~10초에 정확한 확인을 위해 시간이 걸린다는 안내. 현재 60초 기술 상한을 이 11장만으로 낮추지 않는다. 다른 시간대·모바일 회선·추가 와인 표본을 모아 지연 상한을 정한다. 이번 3.024초 최댓값은 보장 시간이 아니다.

## 근거 자료

- [Mouton Cadet Margaux 2022](https://www.moutoncadet.com/fr/vins/reserve-mouton-cadet-margaux/)
- [Ridge Lytton Springs 2012](https://www.ridgewine.com/wines/2012-lytton-springs/) — Wine Information의 구성 사용, 인용된 평론가 문구와 구별.
- [Garzón Tannat Reserva 2023 공식 기술자료](https://bodegagarzon.com/wp-content/uploads/2025/02/Technical-Sheet-Tannat-Reserva-2023-ENG.pdf)
- [Secondo Marco 공식 제품](https://www.secondomarco.it/valpolicella-classico), [2021 보조 대조](https://www.falstaff.com/it/vini/secondo-marco-2021-valpolicella-classico-doc)
- [Percarlo 공식 제품](https://www.fattoriasangiusto.it/it/prodotti/sangiovese-igt-percarlo)
- [Capannelle Solare 공식 제품](https://web.capannelle.it/en/solare/), [생산자 협회 카탈로그의 2013](https://www.chianticlassico.com/wp-content/uploads/catalogo-chianti-classico-collection-2020.pdf)
- [Twenty Rows 2022 기술자료](https://twentyrows.com/wp-content/uploads/2024/05/TwentyRows_CS_RSV_NV_2022_TechSheet.pdf)
- Ricasoli 충돌: [2021 이탈리아 페이지](https://www.ricasoli.com/prodotto/rocca-guicciarda-2021/), [2021 영문 PDF](https://www.ricasoli.com/wp-content/uploads/pdf/rocca-guicciarda-2021-en.pdf)

[측정 데이터](measurements/gemini-knowledge-11-20260922.json). 이번 작업은 측정·문서화이며 앱 동작, 유료 전환, 운영 배포는 변경하지 않았다.
