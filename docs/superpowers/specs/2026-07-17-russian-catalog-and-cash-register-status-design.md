# Catalog public în limba rusă și statut fiscal al vânzărilor

## Scop

Aplicația va oferi catalogul public atât în română, cât și în rusă, folosind
URL-uri indexabile și traduceri rusești salvate în baza de date. Panoul intern
rămâne în română.

Fiecare vânzare va indica separat dacă a fost bătută în casa de marcat.
Indicatorul este ales la crearea unei vânzări directe și poate fi corectat
ulterior de personalul autorizat.

## Limbi și rute publice

Româna rămâne limba implicită și păstrează toate URL-urile existente:

- `/catalog`;
- `/catalog/cauta`;
- `/catalog/{marca}`;
- `/catalog/{marca}/{model}`;
- `/catalog/piesa/{id}`.

Rusa folosește același arbore de conținut sub prefixul `/ru`:

- `/ru/catalog`;
- `/ru/catalog/cauta`;
- `/ru/catalog/{marca}`;
- `/ru/catalog/{marca}/{model}`;
- `/ru/catalog/piesa/{id}`.

Nu se schimbă identificatorii și slug-urile mărcilor, modelelor sau produselor.
Aceeași piesă are astfel un URL românesc și unul rusesc stabil. Un selector
`RO / RU` schimbă limba păstrând, când există, pagina curentă.

Componentele vizuale sunt comune ambelor limbi. Limba curentă este transmisă
explicit către interogări și către helper-ele de linkuri; nu se duplică
implementarea catalogului în două seturi de pagini independente.

## Indexare și metadate

Fiecare pagină publică va avea titlu și descriere în limba afișată, atribut
HTML `lang` corect și legături alternative `hreflang` pentru `ro` și `ru`.
URL-ul canonic corespunde limbii curente. Sitemap-ul și regulile pentru roboți
includ rutele publice rusești, fără a expune rutele CRM.

## Traduceri ale interfeței

Toate textele controlate de aplicație din catalog vor fi mutate într-un
dicționar tipizat română/rusă:

- navigație, butoane și selector de limbă;
- titluri, texte promoționale și statistici;
- etichete de disponibilitate și producție locală;
- căutare, filtre, rezultate, stări goale și mesaje de eroare;
- breadcrumb-uri, recomandări, footer și metadate.

Formatarea numerelor folosește `ro-MD` în română și `ru-MD` în rusă. Mărcile și
modelele auto rămân nume proprii, fără traducere.

## Traduceri salvate pentru datele catalogului

Modelul de date primește câmpuri rusești opționale pentru conținutul public:

- `Product.descriptionRu` și `Product.notesRu`;
- `ProductType.nameRu`;
- `VehicleFitment.labelRu`.

În panoul intern, formularele existente pentru produs, tip de piesă și
compatibilitate permit completarea și corectarea acestor câmpuri. Importurile
existente nu suprascriu o traducere rusă completată manual.

Catalogul rusesc selectează câmpul rusesc când acesta conține text. Dacă o
traducere lipsește, afișează valoarea originală, astfel încât nicio piesă să nu
dispară și nicio pagină să nu rămână goală.

Produsele existente primesc un backfill inițial în rusă. Backfill-ul este
idempotent, completează numai câmpurile rusești goale și produce un raport cu
valorile care nu au putut fi traduse sigur. Valorile raportate rămân vizibile
prin fallback și pot fi corectate din administrare.

Căutarea din ruta rusă verifică atât descrierea/categoria rusă, cât și codul și
valorile originale. Utilizatorul poate astfel găsi o piesă după termenul rus,
după denumirea importată sau după cod.

## Statutul de casă al vânzărilor

`StockDocument` primește câmpul opțional `cashRegistered`:

- `true` — „Bătut în casă”;
- `false` — „Nebătut în casă”;
- `null` — „Nespecificat”, folosit pentru vânzările istorice și pentru orice
  flux vechi care nu furnizează încă alegerea.

Câmpul are sens numai pentru documentele de tip `SALE`. Serverul respinge o
încercare de a-i seta o valoare pe recepții, retururi sau transferuri.

Formularul de vânzare directă cere alegerea explicită `Da` sau `Nu`. Valoarea
face parte și din cererea de aprobare a unui angajat, iar aprobarea păstrează
alegerea în documentul final. Vânzările create prin alte fluxuri compatibile
pot porni ca `Nespecificat`, dar vor putea fi clasificate imediat din listă.

## Afișare și modificare

În secțiunea „Vânzările de azi”, fiecare rând primește un badge vizibil:

- verde pentru „Bătut în casă”;
- portocaliu pentru „Nebătut în casă”;
- neutru pentru „Nespecificat”.

Statutul apare și în arhiva/lista de vânzări, ca informația să nu se piardă
după ziua curentă. Un control din acțiunile vânzării permite schimbarea între
cele trei valori fără a edita liniile, stocul, totalul sau data documentului.

Modificarea este permisă acelorași roluri care pot modifica vânzările. Acțiunea
validează din nou tipul documentului, salvează valoarea și scrie în audit
valoarea veche și valoarea nouă. După salvare se revalidează pagina CRM.

## Compatibilitate și migrare

Migrarea bazei de date este aditivă: toate câmpurile noi sunt opționale, deci
datele și fluxurile existente rămân valide. Clientul Prisma este regenerat după
modificarea schemei.

Rutele românești, codurile produselor, slug-urile existente, exporturile și
calculele financiare nu se schimbă. Statutul fiscal este informațional și nu
modifică stocul, totalurile, retururile, rapoartele sau facturile.

## Testare și criterii de acceptare

Implementarea este acceptată când:

- toate paginile catalogului sunt accesibile atât pe ruta română, cât și pe
  ruta rusă;
- navigarea și selectorul de limbă păstrează limba și pagina curentă;
- interfața, metadatele și stările catalogului sunt traduse complet în rusă;
- o piesă cu traduceri salvate afișează descrierea, notițele, tipul și
  compatibilitatea în rusă;
- o piesă fără traducere folosește fallback-ul fără eroare;
- căutarea rusă găsește termeni rusești, coduri și termeni originali;
- backfill-ul completează traducerile existente fără a suprascrie corecturi
  manuale și raportează valorile rămase;
- o vânzare nouă nu poate fi trimisă fără alegerea statutului de casă;
- alegerea supraviețuiește fluxului de aprobare și apare pe documentul final;
- vânzările istorice apar ca „Nespecificat”;
- statutul unei vânzări poate fi schimbat ulterior, iar schimbarea apare în
  audit fără efect asupra stocului sau totalului;
- serverul refuză modificarea statutului pe un document care nu este vânzare;
- testele repository-ului, TypeScript, lint-ul și build-ul de producție trec.

Testarea automată va acoperi helper-ele de localizare și rute, selecția
traducerilor și fallback-ul, căutarea bilingvă, parsarea statutului, propagarea
prin payload-ul de aprobare și acțiunea de modificare. Verificarea finală va
include paginile catalogului RO/RU și lista vânzărilor la dimensiuni desktop și
mobile, când controlul browserului este disponibil.
