# Metoda de plată a vânzărilor

## Scop

Fiecare vânzare va indica separat metoda prin care a fost achitată: `Cash` sau
`Card`. Metoda de plată nu înlocuiește și nu influențează statutul fiscal
existent „Bătut în casă / Nebătut în casă”.

## Model de date

Prisma va primi enum-ul `SalePaymentMethod` cu valorile `CASH` și `CARD`, iar
`StockDocument` va primi câmpul opțional `paymentMethod` de acest tip. Câmpul
opțional păstrează compatibilitatea cu vânzările istorice, care vor fi afișate
ca „Nespecificat”. Câmpul are sens numai pentru documentele `SALE`; acțiunile
server vor respinge setarea lui pe recepții, retururi sau ajustări.

## Crearea și aprobarea unei vânzări

Formularul de vânzare va cere explicit alegerea `Cash` sau `Card`. Serverul va
valida alegerea, astfel încât cererea să nu poată fi ocolită prin trimiterea
manuală a formularului.

Metoda va face parte din payload-ul tipizat al cererii de vânzare. Pentru
angajații care necesită aprobare, alegerea va apărea în sumarul cererii și va
fi păstrată neschimbată când aprobarea creează documentul final. Pentru
utilizatorii autorizați, metoda va fi salvată direct pe document.

## Afișare și corectare

Metoda de plată va apărea lângă statutul casei de marcat în:

- „Vânzările de azi”;
- arhiva vânzărilor și lista generală de operațiuni;
- panoul cu detaliile documentului;
- cererile de vânzare aflate în aprobare.

Un control dedicat va permite schimbarea ulterioară între `Cash`, `Card` și
`Nespecificat`, fără modificarea liniilor, stocului, totalurilor sau datei.
Această corectare va folosi aceleași permisiuni ca statutul casei și va scrie
în audit valoarea veche și valoarea nouă.

## Exporturi

Exporturile de vânzări care afișează deja informații despre statutul casei vor
include și metoda de plată, pentru ca informația să rămână disponibilă în
rapoartele operaționale. Documentele non-vânzare nu vor afișa acest câmp.

## Compatibilitate și erori

Schimbarea bazei de date este aditivă și nu cere completarea retroactivă a
datelor. O valoare lipsă pe un document istoric este validă. O valoare lipsă
sau necunoscută la crearea unei vânzări noi produce mesajul „Alege metoda de
plată: Cash sau Card.”

Metoda de plată este informațională: nu schimbă stocul, totalurile, TVA-ul,
retururile, sarcinile de reaprovizionare sau relația cu clientul.

## Testare și criterii de acceptare

Implementarea este acceptată când:

- formularul nu poate crea o vânzare nouă fără `Cash` sau `Card`;
- ambele valori sunt validate și salvate corect;
- metoda supraviețuiește fluxului de aprobare;
- vânzările istorice fără valoare apar ca „Nespecificat”;
- metoda apare în liste, detalii, aprobări și exporturile relevante;
- metoda poate fi corectată ulterior și schimbarea este auditată;
- serverul refuză setarea metodei pe un document care nu este vânzare;
- testele focalizate, TypeScript, lint-ul și build-ul de producție trec.

Testarea automată va acoperi parsarea și etichetele metodei, payload-ul de
aprobare, persistența la executarea vânzării, invarianta acțiunii de corectare
și prezența controalelor în interfață.
