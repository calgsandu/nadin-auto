# Autentificare TOTP obligatorie pentru tot personalul

## Obiectiv

Panoul intern Nadin Auto va cere autentificare în doi pași tuturor
utilizatorilor `ADMIN`, `DIRECTOR` și `ANGAJAT`. Neon Auth rămâne primul
factor și continuă să gestioneze autentificarea prin username/parolă și
Google. Aplicația adaugă un al doilea control obligatoriu bazat pe TOTP,
compatibil cu aplicațiile Authenticator uzuale.

Niciun utilizator nu poate citi sau modifica datele interne doar pe baza unei
sesiuni Neon Auth. Accesul complet necesită și o dovadă TOTP validă pentru
sesiunea curentă sau un dispozitiv de încredere încă valabil.

## Cerințe aprobate

- 2FA este obligatoriu pentru toate rolurile și pentru toate metodele de
  autentificare, inclusiv Google.
- Utilizatorii existenți sunt opriți la lansare și trebuie să configureze TOTP
  înainte de a reintra în aplicație.
- Configurarea se face prin scanarea unui QR într-o aplicație Authenticator și
  confirmarea primului cod.
- Un dispozitiv poate fi memorat opțional timp de 30 de zile.
- Nu există coduri de rezervă.
- Un `ADMIN` poate reseta 2FA pentru alt utilizator, dar nu pentru sine.
- Ultimul administrator își poate recupera accesul numai printr-o comandă
  locală, limitată și auditată, de tip break-glass.
- Resetarea, schimbarea parolei și dezactivarea contului invalidează
  dispozitivele memorate conform regulilor de mai jos.

## Abordarea aleasă

Implementarea păstrează Neon Auth și adaugă un gate TOTP la nivelul
aplicației. Nu migrăm utilizatorii, parolele, sesiunile sau integrarea Google
către alt furnizor.

TOTP este implementat cu biblioteci întreținute pentru generarea și validarea
RFC 6238 și pentru QR. Aplicația nu implementează algoritmul criptografic TOTP
și nu persistă niciodată secretul în clar.

## Modelul de acces

Un serviciu central `getAuthAccessState()` clasifică fiecare cerere într-una
din următoarele stări:

- `UNAUTHENTICATED`: lipsește sesiunea Neon Auth sau profilul `AppUser` activ;
- `ENROLLMENT_REQUIRED`: primul factor este valid, dar utilizatorul nu are un
  credential TOTP activ;
- `TOTP_REQUIRED`: utilizatorul are TOTP activ, dar sesiunea curentă nu are o
  dovadă 2FA și nici un dispozitiv memorat valid;
- `AUTHENTICATED`: primul factor și gate-ul 2FA sunt ambele valide.

`getCurrentAppUser()` și `requireCurrentAppUser()` returnează utilizatorul
numai în starea `AUTHENTICATED`. Citirile de date interne, route handlers și
server actions trebuie să treacă prin aceste funcții înainte de a accesa
datele protejate. Funcțiile care citesc numai primul factor sunt interne
modulului 2FA și nu sunt folosite pentru autorizarea funcțională.

Proxy-ul Neon Auth continuă să verifice primul factor pentru rutele interne.
Gate-ul din aplicație este controlul autoritativ pentru al doilea factor; nu
se bazează doar pe ascunderea ecranelor în client. Catalogul public și
endpointurile strict necesare Neon Auth rămân publice conform comportamentului
existent.

## Fluxul după autentificare

Atât acțiunea de login cu parolă, cât și callback-ul Google trimit
utilizatorul la `GET /auth/2fa/continue` după crearea sesiunii Neon Auth. Este
un route handler, nu o pagină randată, deoarece trebuie să poată roti tokenul
de dispozitiv, seta cookie-ul dovezii și răspunde cu redirect.

Ruta de continuare:

1. validează sesiunea Neon, profilul `AppUser` și starea `active`;
2. dacă nu există un credential TOTP activ, trimite utilizatorul la setup;
3. dacă există o dovadă 2FA validă pentru sesiunea curentă, trimite
   utilizatorul în CRM;
4. dacă există un dispozitiv memorat valid, emite o dovadă 2FA pentru sesiunea
   curentă și trimite utilizatorul în CRM;
5. în celelalte cazuri, trimite utilizatorul la verificarea codului TOTP.

Orice acces direct la `/crm`, exporturi, API-uri sau server actions fără
starea `AUTHENTICATED` este refuzat sau redirecționat la pasul potrivit.

## Persistență

### `TwoFactorCredential`

Credentialul este legat unu-la-unu de `AppUser` și conține:

- identificator unic și `appUserId` unic;
- starea `PENDING` sau `ACTIVE`;
- secretul TOTP criptat într-un pachet versionat;
- `setupExpiresAt` pentru un setup neconfirmat;
- `verifiedAt` pentru activarea finală;
- `lastAcceptedStep`, folosit pentru prevenirea reutilizării unui cod;
- datele standard de creare și actualizare.

Identificatorul credentialului reprezintă și generația curentă. Resetarea îl
șterge, iar orice credential creat ulterior primește alt identificator. Toate
dovezile și dispozitivele asociate credentialului vechi devin astfel invalide.

### `TwoFactorSessionProof`

Dovada celui de-al doilea factor pentru sesiunea curentă conține:

- `appUserId` și `credentialId`;
- hash-ul tokenului opac din cookie;
- hash-ul identificatorului sesiunii Neon Auth;
- data expirării și data creării.

Dovada este valabilă numai pentru aceeași sesiune Neon, același utilizator și
același credential TOTP. Expirarea ei nu depășește expirarea sesiunii Neon.
În baza de date și în cookie nu se stochează codul TOTP.

### `TrustedDevice`

Un dispozitiv memorat conține:

- `appUserId` și `credentialId`;
- hash-ul tokenului opac din cookie;
- `expiresAt`, setat la 30 de zile;
- `createdAt` și `lastUsedAt`.

Ștergerea credentialului elimină în cascadă dovezile de sesiune și
dispozitivele asociate. Nu se stochează fingerprint de browser și nu se
folosesc adresa IP sau user-agentul ca factor de autentificare.

### `TwoFactorRateLimit`

Limitarea distribuită folosește Postgres, nu memorie locală, pentru a funcționa
corect pe mai multe instanțe Vercel. Bucketurile păstrează numai chei hash-uite,
numărul eșecurilor, începutul ferestrei și momentul până la care verificarea
este blocată.

- utilizator plus sesiune: maximum 5 eșecuri în 10 minute, urmate de blocare
  pentru 15 minute;
- adresă IP: maximum 25 de eșecuri în 10 minute, urmate de blocare pentru 15
  minute.

Adresa IP este citită numai din header-ele de infrastructură pe care deploymentul
le consideră de încredere, apoi este normalizată și hash-uită cu un pepper din
mediul serverului. Header-ele arbitrare trimise de client nu pot selecta cheia
bucketului. Valorile expirate sunt curățate oportunist, în loturi limitate, în
timpul operațiunilor 2FA; nu este necesar un cron pentru corectitudinea
controlului.

## Criptografie și secrete

TOTP folosește:

- RFC 6238;
- SHA-1, pentru compatibilitate largă cu aplicațiile Authenticator;
- 6 cifre;
- interval de 30 de secunde;
- issuer `Nadin Auto`;
- username-ul normalizat drept etichetă;
- fereastră de validare de cel mult un interval înainte sau după timpul
  serverului.

Secretul TOTP este generat cu un generator criptografic sigur și criptat cu
AES-256-GCM. `TWO_FACTOR_ENCRYPTION_KEY` este o cheie aleatoare de 32 de bytes,
codificată base64 și păstrată numai în mediul serverului. Pachetul persistat
conține versiunea formatului, IV-ul, ciphertext-ul și authentication tag-ul.

Tokenurile pentru dovada de sesiune și dispozitivul memorat au minimum 256 de
biți de entropie. Browserul primește tokenul opac, iar baza de date primește
numai SHA-256(token). Cookie-urile sunt `HttpOnly`, `Secure`, `SameSite=Lax`
și au `Path=/`; în producție folosesc prefixul `__Host-`. Dezvoltarea implicită
folosește HTTPS, conform scriptului existent al proiectului.

`TWO_FACTOR_RATE_LIMIT_PEPPER` are minimum 32 de bytes aleatori și este separat
de cheia de criptare. Configurația 2FA validează ambele secrete și refuză
operațiile 2FA dacă lipsesc sau au format invalid. Nu există fallback la
valori implicite. Schimbarea accidentală a cheii de criptare face
credentialele existente inutilizabile, de aceea cheia trebuie păstrată în
managerul de secrete și inclusă în procedura securizată de recuperare a
infrastructurii.

Secretul TOTP, codurile introduse și tokenurile brute nu apar în URL-uri,
loguri, erori, audit sau analytics.

## Configurarea TOTP

Pentru un utilizator fără credential activ:

1. serverul generează un secret și îl persistă criptat ca `PENDING`, cu
   expirare după 15 minute;
2. pagina de setup construiește URI-ul `otpauth://` și afișează QR-ul și cheia
   manuală fără a le pune în URL-ul paginii;
3. utilizatorul introduce primul cod;
4. serverul verifică limita de încercări, decriptează secretul și validează
   codul;
5. într-o actualizare atomică, credentialul devine `ACTIVE`, `verifiedAt` și
   `lastAcceptedStep` sunt setate și se creează dovada sesiunii;
6. dacă utilizatorul a bifat memorarea dispozitivului, se creează și tokenul
   de încredere pentru 30 de zile.

Un setup expirat sau alterat este șters și înlocuit cu unul nou. Reîncărcarea
paginii în cele 15 minute reutilizează același setup pending, evitând QR-uri
multiple active. O acțiune explicită de regenerare invalidează secretul
pending anterior.

Credentialul nu devine activ până când primul cod nu este verificat. Nu se
generează coduri de rezervă.

## Verificarea la login

Pentru un credential activ, utilizatorul introduce codul de șase cifre și
poate bifa „Ține minte acest dispozitiv 30 de zile”. Serverul:

1. confirmă din nou sesiunea Neon și utilizatorul activ;
2. aplică limitele pe sesiune/utilizator și IP;
3. validează codul în fereastra permisă;
4. marchează atomic intervalul TOTP acceptat;
5. emite dovada legată de sesiunea Neon;
6. emite opțional tokenul dispozitivului memorat;
7. redirecționează către destinația internă permisă.

Actualizarea `lastAcceptedStep` este condiționată de faptul că noul interval
este mai mare decât cel deja folosit. Două cereri paralele cu același cod nu
pot reuși ambele. Dacă răspunsul unei verificări reușite se pierde, codul nu se
reutilizează; utilizatorul așteaptă intervalul următor.

Un dispozitiv memorat valid poate crea automat o dovadă pentru o sesiune Neon
nouă. Tokenul este rotit după folosire, astfel încât valoarea anterioară nu mai
poate fi rejucată. Tokenul nu înlocuiește primul factor.

## Sesiuni, logout și schimbări de cont

- Logout-ul șterge dovada sesiunii curente și cookie-ul ei înainte de
  închiderea sesiunii Neon. Tokenul și cookie-ul dispozitivului memorat sunt
  păstrate, cu excepția cazului în care utilizatorul a ales explicit
  „Deconectează și uită dispozitivul”.
- Schimbarea parolei proprii păstrează credentialul TOTP, dar șterge toate
  dispozitivele memorate. Sesiunea curentă poate rămâne complet autentificată;
  sesiunile noi cer din nou TOTP.
- Resetarea parolei de către administrator păstrează credentialul TOTP, șterge
  dispozitivele și dovezile existente și revocă sesiunile Neon.
- Dezactivarea contului păstrează credentialul TOTP pentru o posibilă
  reactivare, dar șterge dispozitivele și dovezile și revocă sesiunile Neon.
- Reactivarea cere login și TOTP din nou; niciun dispozitiv vechi nu revine.

Orice nepotrivire între utilizatorul sesiunii Neon și utilizatorul tokenului
2FA invalidează tokenul și blochează accesul.

## Resetarea de către administrator

În secțiunea „Personal”, fiecare alt utilizator afișează starea „2FA activ”,
„În configurare” sau „Neconfigurat”. Numai un actor `ADMIN` aflat în starea
`AUTHENTICATED` vede acțiunea de resetare.

Resetarea cere introducerea exactă a username-ului țintă. Serverul verifică
din nou rolul, starea actorului și faptul că actorul nu este ținta. Într-o
tranzacție locală:

1. șterge credentialul TOTP, dovezile și dispozitivele țintei;
2. setează `AppUser.twoFactorResetAt` la timpul curent;
3. scrie intrarea `AuditLog` fără secrete.

După tranzacție, serverul revocă toate sesiunile Neon ale țintei. Controlul
local rămâne fail-closed chiar dacă revocarea externă eșuează: o sesiune creată
înainte de `twoFactorResetAt` nu poate începe un setup nou și este trimisă la
login. Numai o sesiune de prim factor creată după resetare poate configura un
credential nou. Interfața raportează eșecul revocării pentru reîncercare, fără
a restaura accesul vechi.

Auto-resetarea din interfață este interzisă inclusiv unui administrator.

## Procedura break-glass

Ultimul administrator poate folosi exclusiv un script local, fără rută HTTP:

```text
pnpm staff:reset-2fa --username ion --reason "telefon pierdut"
```

Scriptul:

- cere un username normalizat exact și un motiv nevid;
- caută și afișează id-ul, username-ul, numele, rolul și starea țintei;
- refuză ținte inexistente și refuză execuția fără terminal interactiv;
- cere tastarea exactă a textului `RESET <username>`;
- nu citește, decriptează sau afișează secretul existent;
- execută aceeași resetare locală fail-closed ca acțiunea administrativă;
- încearcă revocarea tuturor sesiunilor Neon;
- scrie audit cu actorul `BREAK_GLASS` și motivul furnizat;
- returnează cod de ieșire nenul la orice eșec sau rezultat parțial.

Nu există opțiune generică de resetare în masă și nici variantă neinteractivă
cu `--force`. Scriptul nu oferă capabilități pe care un operator cu acces la
baza de producție nu le are deja, dar reduce operația normală de recuperare la
o țintă exactă, confirmată și auditată.

## Tratarea erorilor

- Erorile de cod invalid, expirat sau reutilizat folosesc același mesaj
  generic în română.
- Starea de blocare arată timpul până la care se poate reîncerca, fără detalii
  despre secret sau intervalul acceptat.
- Lipsa sesiunii, utilizatorul inactiv și tokenurile care nu corespund duc la
  login sau la pasul 2FA corect, fără bucle de redirecționare.
- Erorile bazei de date, criptării, tokenului sau stările necunoscute refuză
  accesul. Nu există mod degradat care sare peste 2FA.
- Validarea codului și consumarea intervalului sunt atomice.
- Resetarea concurentă cu verificarea invalidează verificarea prin schimbarea
  identificatorului credentialului și ștergerea dovezilor dependente.

## Interfață

Ecranul obligatoriu de setup conține:

- explicație scurtă în română;
- QR-ul;
- cheia manuală, ascunsă implicit și copiabilă;
- câmpul pentru codul de șase cifre;
- opțiunea de memorare a dispozitivului;
- regenerarea explicită a QR-ului;
- logout, pentru schimbarea contului.

Ecranul de verificare conține codul de șase cifre, opțiunea „Ține minte acest
dispozitiv 30 de zile”, starea de așteptare/blocare și logout. Nu oferă
recuperare prin email sau coduri de rezervă; indică utilizatorului să contacteze
administratorul dacă a pierdut dispozitivul.

Secțiunea „Personal” afișează starea 2FA și resetarea numai acolo unde actorul
are dreptul. Nu afișează secrete, QR-uri sau dispozitivele altui utilizator.

## Rollout

Lansarea se face în două etape tehnice, fără perioadă în care 2FA este
opțional:

1. se aplică schema compatibilă înapoi și se configurează secretele de mediu;
2. se lansează gate-ul și ecranele 2FA.

Înainte de etapa a doua se verifică existența a cel puțin unui `ADMIN` activ cu
username și disponibilitatea comenzii break-glass. După lansarea gate-ului,
lipsa unui credential activ produce `ENROLLMENT_REQUIRED` pentru fiecare
utilizator existent. Acest lucru se aplică și sesiunilor Neon deja deschise;
nu se face backfill care să le acorde acces implicit.

Nu există feature flag care permite ocolirea 2FA în producție.

## Testare

### Teste unitare

- validarea configurației și a lungimii cheilor;
- criptare/decriptare și respingerea ciphertextului, IV-ului sau tag-ului
  alterat;
- generarea URI-ului TOTP fără scurgeri în log;
- cod valid, cod din ferestrele permise, cod în afara ferestrei și cod
  reutilizat;
- tokenuri opace, hashing, expirare și rotație;
- tranzițiile celor patru stări de acces;
- calculul bucketurilor și blocarea după limitele aprobate.

### Teste de integrare

- o sesiune Neon fără dovadă 2FA nu poate obține `CurrentAppUser`;
- paginile, route handlers și server actions protejate refuză primul factor
  singur;
- setup-ul pending expiră și este înlocuit;
- confirmarea setup-ului activează credentialul o singură dată;
- verificarea creează o dovadă legată de sesiunea Neon corectă;
- un token de la alt utilizator sau altă sesiune este respins;
- dispozitivul memorat funcționează înainte de 30 de zile și este respins după
  expirare;
- două verificări concurente cu același cod au cel mult un succes;
- resetarea admin este permisă numai pentru alt utilizator și scrie audit;
- resetarea face sesiunile anterioare neeligibile pentru enrollment;
- schimbarea/resetarea parolei și dezactivarea șterg dispozitivele conform
  regulilor;
- comanda break-glass cere username, motiv și confirmare exactă.

### Teste end-to-end și regresie

- login prin username/parolă, enrollment obligatoriu și intrare în CRM;
- login prin Google urmat de același gate;
- login ulterior cu TOTP;
- login ulterior cu dispozitiv memorat;
- expirarea și resetarea dispozitivului;
- utilizator deja conectat la momentul rolloutului este trimis la setup;
- pierderea telefonului, resetarea de către alt admin și enrollment nou;
- logout-ul nu lasă o dovadă de sesiune reutilizabilă;
- catalogul public rămâne accesibil;
- testele existente de autentificare, roluri, personal și autorizare continuă
  să treacă.

Verificarea finală include suita completă de teste, lint, build de producție și
probe autentificate în browser pentru setup, verificare, memorarea
dispozitivului și resetarea administrativă.

## Criterii de acceptare

- Niciun rol și nicio metodă de login nu poate ocoli TOTP.
- O sesiune Neon validă, singură, nu poate citi sau modifica date interne.
- Toți utilizatorii existenți configurează TOTP la prima cerere internă după
  rollout.
- Secretul TOTP este criptat la repaus și nu apare în loguri, audit sau URL.
- Codurile sunt limitate, nu pot fi reutilizate și sunt validate atomic.
- Dispozitivul memorat expiră după 30 de zile și este legat de utilizator și
  credential.
- Resetarea parolei, dezactivarea și resetarea 2FA invalidează accesul conform
  regulilor documentate.
- Un administrator poate reseta alt utilizator, dar nu se poate auto-reseta.
- Ultimul administrator poate fi recuperat prin comanda interactivă auditată,
  fără endpoint break-glass.
- Erorile infrastructurii blochează accesul în loc să dezactiveze 2FA.

## În afara scopului

- coduri de rezervă;
- recuperare 2FA prin email, SMS sau WhatsApp;
- WebAuthn/passkeys;
- memorarea nelimitată a dispozitivelor;
- configurarea opțională pe rol sau utilizator;
- migrarea de la Neon Auth;
- resetarea 2FA în masă;
- acces de urgență printr-un endpoint web.
