# Stoc pe depozite pentru fiecare produs

## Scop

Fiecare produs trebuie să aibă o cantitate independentă în fiecare depozit, iar aplicația trebuie să afișeze și să folosească stocul total al produsului ca suma cantităților din depozite.

Exemplu: o aripă poate avea 2 bucăți în Pavilion 110A și 4 bucăți în Pavilion 514; stocul total afișat este 6.

## Decizie de arhitectură

Modelul existent `WarehouseStock` devine sursa principală pentru distribuția stocului:

- un rând reprezintă perechea produs–depozit;
- combinația `[productId, warehouseId]` rămâne unică;
- `Product.stock` rămâne un total denormalizat, sincronizat cu suma tuturor rândurilor `WarehouseStock` pentru compatibilitate cu modulele existente;
- toate operațiunile care mută stocul pe depozit păstrează sincronizarea totalului într-o tranzacție.

Nu se introduce un al doilea model de stoc și nu se elimină în această etapă coloana `Product.stock`, pentru a limita riscul asupra catalogului, rapoartelor, exporturilor, căutării și vitrinei.

## Migrarea datelor existente

Migrarea va folosi depozitul „Pavilion 110A” pentru stocurile istorice care nu au încă o defalcare:

1. se asigură existența depozitului „Pavilion 110A”;
2. pentru fiecare produs fără rânduri `WarehouseStock`, se creează un rând în 110A cu valoarea existentă din `Product.stock` sau 0;
3. pentru produsele care au deja rânduri pe depozite, se păstrează distribuția existentă și se rescrie `Product.stock` cu suma rândurilor;
4. operațiunea este idempotentă și nu dublează stocul la o a doua rulare.

Astfel, stocul global importat ajunge în 110A, iar stocurile deja urmărite pe depozite nu sunt pierdute.

## Fluxuri de modificare

Operațiunile existente rămân pe depozitul ales:

- recepția adaugă cantitatea în depozitul selectat;
- vânzarea scade cantitatea doar din depozitul selectat și verifică disponibilul local;
- returul adaugă în depozitul vânzării sursă;
- transferul scade din depozitul sursă și adaugă în depozitul destinație;
- inventarul corectează cantitatea doar în depozitul inventariat;
- ștergerea sau editarea unui document inversează efectul în depozitul documentului.

Formularul de editare a produsului va permite setarea directă a stocului curent pentru fiecare depozit activ. Salvarea va:

- valida câte o valoare pentru fiecare depozit activ;
- trata câmpul gol ca 0;
- respinge valori negative, fracționare, text invalid, depozite necunoscute sau duplicate;
- actualiza/upsert-ui rândurile `WarehouseStock` într-o singură tranzacție;
- păstra rândurile depozitelor inactive și le include în total;
- recalcula `Product.stock` după salvare;
- păstra o urmă în audit pentru modificarea distribuției.

Formularul nu va mai permite editarea unui total global care poate contrazice distribuția pe depozite. Totalul va fi afișat ca valoare calculată, needitabilă.

## Interfață

În catalog:

- coloana „Stoc” va afișa totalul;
- sub total se va afișa defalcarea pe depozite, inclusiv cantitățile 0 pentru depozitele active relevante;
- formularul produsului va avea câte un câmp numeric pentru fiecare depozit activ;
- totalul se va recalcula instant în formular.

Secțiunea de inventar și dialogurile de recepție, vânzare și transfer vor rămâne bazate pe alegerea explicită a depozitului.

## Compatibilitate

Filtrarea „doar în stoc”, căutarea produselor, vitrina, rapoartele și exporturile vor continua să consume `Product.stock`, care va fi sincronizat după fiecare modificare. Raportarea pe depozite va consuma `WarehouseStock`.

Pragul `minStock` rămâne un prag global pe produs în această etapă; nu se introduc praguri diferite pe depozite.

## Testare și criterii de acceptare

Implementarea este acceptată când:

- stocurile fără defalcare sunt mutate în 110A fără dublare la rulări repetate;
- se poate salva un produs cu valori diferite pe cel puțin două depozite;
- totalul produsului este suma tuturor depozitelor;
- recepția, vânzarea, returul, transferul, inventarul, editarea și ștergerea documentelor modifică depozitul corect și păstrează totalul sincronizat;
- vânzarea nu poate depăși stocul depozitului selectat chiar dacă există stoc în alt depozit;
- parserul respinge valori invalide și acceptă câmpuri goale ca 0;
- testele existente, TypeScript, lint-ul și build-ul trec.

Se vor adăuga teste unitare pentru parserul distribuției pe depozite și pentru calculul totalului, apoi se vor executa toate testele repository-ului, lint-ul și build-ul.
