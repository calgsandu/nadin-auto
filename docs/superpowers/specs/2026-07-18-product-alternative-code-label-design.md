# Cod alternativ pe sticker — design

## Scop

Produsele pot avea un singur cod alternativ opțional, folosit de furnizor. Codul este salvat împreună cu produsul și apare automat pe stickere.

## Comportament

- Formularul de creare și editare produs primește câmpul opțional „Cod alternativ”.
- Valoarea este curățată de spațiile de la început și sfârșit; un câmp gol se salvează ca `null`.
- Stickerul afișează `COD PRINCIPAL / COD ALTERNATIV` când există cod alternativ.
- Când codul alternativ lipsește, stickerul afișează doar codul principal, identic cu comportamentul actual.
- Separatorul `/` este adăugat numai când ambele coduri sunt prezente; nu se afișează separator sau spații suplimentare pentru valori lipsă.
- Codul alternativ este inclus în snapshot-urile de audit pentru creare și editare.

## Arhitectură și flux de date

Modelul Prisma `Product` primește coloana nullable `alternativeCode`. Formularul trimite valoarea prin `FormData`, acțiunile de catalog o normalizează și o persistă la creare și editare, iar pagina de print citește câmpul direct din produs.

Formatarea codurilor de pe sticker este izolată într-o funcție pură din modulul de etichete. Aceasta face posibilă verificarea separată a cazurilor cu și fără cod alternativ, fără a testa randarea întregii pagini Next.js.

## Compatibilitate și erori

Schimbarea este retrocompatibilă: produsele existente au `alternativeCode = null`. Nu se introduce nicio validare obligatorie și nu se schimbă selecția produselor sau URL-ul de print.

## Testare

- Test unitar: cod principal + cod alternativ produce `COD PRINCIPAL / COD ALTERNATIV`.
- Test unitar: lipsa codului alternativ păstrează doar codul principal.
- Test unitar: valori goale nu produc separator izolat.
- Verificare Prisma: schema validează și clientul generat include noul câmp.
- Verificare proiect: testele, lint-ul și build-ul rulează după implementare.
