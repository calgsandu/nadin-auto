# Etichete: început cu 2 mm mai sus

## Scop

Pentru formatul mare de etichetă pe foaie A4, prima etichetă trebuie să înceapă cu 2 mm mai sus decât în prezent: de la 20 mm la 18 mm față de marginea superioară a foii.

## Design aprobat

Constanta `LABEL_SIZES.l.my` din `src/lib/labels/layout.ts` va fi schimbată de la `20` la `18`. Atât previzualizarea/tipărirea din `src/app/print/labels/page.tsx`, cât și exportul PDF din `src/app/api/export/labels/route.ts` consumă această constantă, astfel încât nu este necesară logică duplicată.

Testul de layout va actualiza așteptarea pentru `my` la `18` și va păstra verificarea că grila încape în pagina A4.

## Criterii de acceptare

- Prima linie de stickere mari începe la 18 mm de marginea superioară.
- Dimensiunile stickerelor și numărul de rânduri/coloane rămân neschimbate.
- Exportul PDF folosește aceeași poziție verticală.
- Testele de layout trec.

## Non-obiective

- Nu se schimbă poziționarea formatelor mic și mediu.
- Nu se schimbă spațierea internă a textului din sticker.
- Nu se schimbă poziționarea pe orizontală sau funcția de salt al pozițiilor.
