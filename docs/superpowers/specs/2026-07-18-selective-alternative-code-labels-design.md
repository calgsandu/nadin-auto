# Selectarea codului alternativ per sticker — design

## Scop

Operatorul decide separat pentru fiecare produs selectat dacă stickerul va include codul alternativ. Implicit, stickerul conține doar codul principal.

## Interfață

- În panoul „Cantități pentru print”, fiecare produs care are un cod alternativ primește bifa „Include cod alternativ”.
- Bifa este debifată implicit la selectarea produsului.
- Produsele fără cod alternativ afișează opțiunea dezactivată sau nu permit activarea ei.
- Cantitatea și opțiunea codului alternativ sunt independente pentru fiecare produs.

## Stare și compatibilitate

Selecția salvată în `sessionStorage` primește câmpurile `alternativeCode` și `includeAlternativeCode`. Selecțiile vechi sunt migrate la citire cu valori implicite goale și `false`, fără pierderea produselor sau cantităților.

Metadatele vizibile ale produsului hidratează codul alternativ, dar nu suprascriu alegerea operatorului. Dacă produsul nu mai are cod alternativ, alegerea este resetată la `false`.

## Transport către print

Parametrul existent `items=id:count,...` rămâne neschimbat. Un parametru separat `alt=id1,id2,...` conține numai produsele pentru care operatorul a bifat includerea codului alternativ.

Linkurile vechi fără `alt` imprimă doar codul principal. Schimbarea cantității, formatului sau mărimii în pagina de print și descărcarea PDF păstrează parametrul `alt`.

## Randare

Pagina HTML și exportul PDF apelează formatterul existent cu codul alternativ numai dacă ID-ul produsului se află în `alt`. Rezultatul este:

- nebifat: `COD PRINCIPAL`;
- bifat: `COD PRINCIPAL / COD ALTERNATIV`.

## Testare

- Parsarea selecțiilor vechi produce `includeAlternativeCode: false`.
- Activarea opțiunii funcționează doar când produsul are cod alternativ.
- Query-ul de print omite `alt` implicit și îl adaugă numai pentru produsele bifate.
- HTML și PDF parsează și folosesc aceeași selecție `alt`.
- Testele focalizate, lint-ul fișierelor atinse și build-ul de producție verifică integrarea.
