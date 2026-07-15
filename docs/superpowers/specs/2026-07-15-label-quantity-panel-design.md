# Panou extensibil pentru cantitățile stickerelor

## Scop

Utilizatorul poate stabili numărul de stickere pentru fiecare produs direct din bara flotantă de selecție a catalogului, înainte de deschiderea previzualizării de print.

## Interacțiune

- La selectarea primului produs, bara flotantă apare cu lista de produse deschisă în sus.
- Lista afișează pentru fiecare produs codul, descrierea și controalele minus, cantitate și plus.
- Cantitatea inițială este 1 și poate fi modificată între 1 și 50.
- Un control cu săgeată restrânge lista în jos sau o extinde din nou; rezumatul și acțiunile principale rămân vizibile.
- Deselectarea unui produs din tabel îl elimină și din panou. Acțiunea „Deselectează” golește întreaga selecție.
- „Printează stickere” deschide previzualizarea existentă și transmite cantitățile individuale prin parametrul `items=id:cantitate`.

## Date și persistență

Checkbox-urile produselor expun identificatorul, codul și descrierea prin atribute `data-*`. Bara păstrează în `sessionStorage` obiectele selectate și cantitățile lor, astfel încât selecția să supraviețuiască paginării și reîncărcării în aceeași sesiune. Citirea datelor vechi, stocate ca listă de ID-uri, rămâne compatibilă.

## Structură UI

Componenta existentă `LabelPicker` rămâne proprietarul selecției. Bara flotantă devine un container cu două zone:

1. lista extensibilă, cu înălțime maximă și derulare pentru selecții numeroase;
2. bara permanentă cu numărul produselor, controlul de extindere, „Deselectează” și „Printează stickere”.

Aspectul folosește paleta, bordurile, umbrele și tipografia existente. Pe ecrane înguste, containerul ocupă lățimea disponibilă, iar acțiunile rămân accesibile.

## Limite și erori

- Cantitățile sunt rotunjite și limitate la intervalul 1–50, identic cu pagina de print.
- Datele `sessionStorage` invalide sunt ignorate și selecția pornește goală.
- Butonul minus este dezactivat la 1, iar plus la 50.
- Panoul nu este inclus la printare.

## Verificare

- Teste unitare pentru citirea, migrarea, actualizarea și serializarea selecției.
- Lint și verificare TypeScript/build pentru fișierele modificate.
- Verificare în browser: deschidere automată, restrângere/extindere, paginare, editarea cantităților, deselectare și URL-ul trimis către previzualizarea de print.
