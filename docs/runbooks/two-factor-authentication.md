# Autentificare 2FA: lansare și recuperare

Acest runbook acoperă lansarea TOTP obligatorie pentru toți utilizatorii activi,
resetarea normală de către un administrator și recuperarea break-glass.

## Pregătire

Lucrează mai întâi pe o ramură Neon izolată sau pe o bază pentru care există un
backup verificat. Înainte de `db:push`, confirmă că există cel puțin un
administrator activ cu username și că aplicația rulează implicit prin HTTPS.

Generează separat cele două valori secrete:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

Salvează prima valoare ca `TWO_FACTOR_ENCRYPTION_KEY`, iar a doua ca
`TWO_FACTOR_RATE_LIMIT_PEPPER`. Nu le reutiliza, nu le afișa în loguri și nu le
comite în Git. Configurează aceleași valori în mediul care va folosi baza de
date; cheia de criptare trebuie păstrată și într-un secret backup controlat.

Validează și aplică schema numai pe ramura Neon/backup-ul pregătit:

```bash
pnpm exec prisma validate
pnpm prisma:generate
pnpm db:push
pnpm staff:reset-2fa --help
```

Ultima comandă trebuie testată într-un shell interactiv care va fi disponibil
și în incident. `--help` nu accesează și nu modifică baza de date.

## Lansare

1. Publică variabilele secrete și schema înaintea codului care activează poarta
   2FA.
2. Publică aplicația pe HTTPS și verifică accesul public la `/catalog` și
   `/ru/catalog`.
3. Autentifică un cont de test. Utilizatorul trebuie trimis la configurare,
   înainte să fie încărcate date CRM.
4. Scanează QR-ul, confirmă un cod curent și verifică autentificarea cu și fără
   opțiunea de memorare pentru 30 de zile.
5. Verifică un cont cu parolă și unul Google. Ambele trebuie să treacă prin
   același dispatcher 2FA.
6. Testează resetarea contului de test din Personal, apoi elimină credențialul
   de test prin aceeași resetare normală.

Nu folosi resetarea break-glass pe un cont de producție doar ca smoke test.

## Resetare normală de către administrator

În CRM, deschide Personal, verifică utilizatorul și starea 2FA, apoi apasă
„Resetează 2FA”. Confirmă username-ul exact. Resetarea șterge credențialul,
dovezile 2FA și toate dispozitivele memorate, scrie auditul în aceeași tranzacție
și revocă sesiunile Neon. Utilizatorul trebuie să se autentifice din nou și să
înroleze o aplicație Authenticator nouă.

Administratorul curent nu se poate reseta pe sine din interfață.

## Recuperarea singurului administrator

Folosește doar dintr-un terminal interactiv securizat, cu accesul și variabilele
mediului corect:

```bash
pnpm staff:reset-2fa --username <username-exact> --reason "<motiv incident>"
```

Comanda afișează numai identitatea țintei și cere confirmarea exactă
`RESET <username>`. Resetarea și auditul `BREAK_GLASS` sunt atomice; după commit
sunt revocate sesiunile Neon. Nu există opțiune `--force` și comanda refuză un
stdin/stdout non-interactiv.

## Incidente

### Revocarea Neon eșuează după resetare

Resetarea locală rămâne aplicată intenționat: timestamp-ul de resetare face
sesiunea existentă neeligibilă pentru CRM. Păstrează eroarea ca incident,
blochează identitatea Neon dacă este necesar și reîncearcă revocarea sesiunilor.
Nu restaura credențialul local pentru a ascunde eroarea de sincronizare.

### Cheia de criptare este pierdută

Fără `TWO_FACTOR_ENCRYPTION_KEY`, secretele TOTP existente nu mai pot fi
decriptate. Oprește autentificarea protejată, caută mai întâi copia controlată a
aceleiași chei și nu genera o valoare nouă peste mediul existent. Dacă cheia nu
poate fi recuperată, tratează situația ca incident de securitate și resetează
controlat credențialele tuturor utilizatorilor, cu audit și comunicare.

### Rollback

Tabelele 2FA sunt aditive; un rollback de cod nu le elimină automat și nu trebuie
urmat de ștergerea lor în grabă. Revenirea la codul vechi elimină poarta 2FA din
aplicație, deci este o decizie explicită de securitate, nu un rollback tehnic
neutru. Păstrează datele și secretele până la hotărârea incident commander-ului,
apoi documentează perioada în care accesul a funcționat fără al doilea factor.

## Dispozitiv memorat

Controlul „Uită acest dispozitiv” șterge numai tokenul de încredere al browserului
curent. Nu închide sesiunea curentă; la următoarea autentificare va fi cerut din
nou codul TOTP. Schimbarea parolei, dezactivarea contului și resetarea 2FA șterg
toate dispozitivele memorate ale utilizatorului.
