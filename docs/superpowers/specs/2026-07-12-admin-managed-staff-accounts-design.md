# Conturi de personal administrate exclusiv de administrator

## Obiectiv

Panoul intern Nadin Auto nu permite înregistrarea publică. Numai un utilizator cu rolul `ADMIN` poate crea și administra conturile personalului. Angajații se autentifică folosind un nume de utilizator și o parolă, fără să aibă nevoie de o adresă personală de email.

## Decizii aprobate

- Păstrăm Neon Auth pentru stocarea sigură a parolelor și gestionarea sesiunilor.
- Eliminăm înregistrarea publică. Google rămâne numai pentru identitățile deja aprobate, ca administratorul legacy să nu fie blocat; o identitate Google nouă nu primește profil sau acces.
- Administratorul creează contul, alege rolul și stabilește ori generează parola inițială.
- Parola este afișată numai în rezultatul acțiunii de creare sau resetare. Nu este salvată în baza aplicației și nu poate fi recuperată ulterior.
- Schimbarea parolei de către utilizator este disponibilă, dar nu obligatorie.
- Un cont care nu mai trebuie să aibă acces este dezactivat, nu șters.

## Arhitectură

### Identitatea din aplicație

Modelul `AppUser` primește:

- `username`: identificator unic, normalizat la litere mici și folosit la autentificare;
- `active`: stare booleană, implicit `true`;
- emailul tehnic rămâne disponibil doar pentru integrarea Neon Auth și nu este prezentat utilizatorului.

Numele de utilizator acceptă litere latine mici, cifre, punct, cratimă și underscore. Este între 3 și 32 de caractere. Valoarea introdusă este curățată și convertită la litere mici înainte de verificarea unicității.

### Maparea către Neon Auth

Neon Auth cere email pentru autentificarea cu parolă. Aplicația convertește intern un username normalizat într-un email tehnic determinist dintr-un domeniu rezervat aplicației. Utilizatorul introduce și vede numai username-ul.

Crearea, resetarea parolei, blocarea și deblocarea folosesc metodele administrative Neon Auth. Rolurile funcționale `ADMIN`, `DIRECTOR` și `ANGAJAT` rămân în `AppUser`; rolul administrativ intern al furnizorului de autentificare nu înlocuiește autorizarea aplicației.

## Controlul accesului

- Ruta `/auth/sign-up` nu mai oferă formular de înregistrare și redirecționează la autentificare.
- Formularul nu afișează link de creare cont. Google este marcat explicit „doar conturi existente”, iar accesul rămâne condiționat de un `AppUser` activ.
- Endpointul proxy de autentificare respinge explicit cererile de creare publică a contului.
- După validarea sesiunii Neon Auth, aplicația caută un `AppUser` existent după `authUserId`.
- Nu se mai creează automat un `AppUser` la prima autentificare.
- Accesul este acordat numai dacă profilul există și `active` este `true`.
- Toate acțiunile de administrare verifică pe server că actorul curent are rolul `ADMIN`.

Aceste controale sunt intenționat redundante: chiar dacă cineva creează direct o identitate la furnizorul de autentificare, identitatea nu primește acces la panou fără un profil aprobat și activ.

## Fluxuri

### Crearea unui utilizator

În secțiunea „Personal”, administratorul apasă „Adaugă utilizator” și completează numele, username-ul, rolul și parola inițială. Parola poate fi introdusă sau generată sigur de aplicație.

Serverul:

1. validează permisiunea administratorului și datele;
2. verifică unicitatea username-ului;
3. creează identitatea Neon Auth;
4. creează profilul `AppUser` asociat;
5. înregistrează operațiunea în audit fără parolă;
6. returnează parola numai în răspunsul curent, pentru copiere.

Dacă profilul aplicației nu poate fi creat după identitatea Neon, serverul încearcă să elimine identitatea nouă și raportează o eroare clară. Nu se raportează succes parțial.

### Autentificarea

Utilizatorul introduce username-ul și parola. Serverul normalizează username-ul, construiește identificatorul tehnic și apelează Neon Auth. După autentificare, accesul este acordat numai profilului asociat și activ. Mesajul pentru username inexistent, parolă greșită sau cont neaprobat este generic, pentru a nu divulga lista de utilizatori.

### Resetarea parolei

Administratorul alege „Resetează parola”, introduce sau generează o parolă nouă, iar Neon Auth o înlocuiește. Parola apare o singură dată în confirmare. Parola veche nu poate fi vizualizată.

Dacă profilul existent are numai o identitate socială, resetarea creează prin API-ul administrativ Neon o identitate nouă username/parolă și leagă `AppUser` de aceasta. Vechea identitate socială rămâne fără profil aprobat și nu mai poate accesa panoul.

### Schimbarea parolei proprii

Utilizatorul poate deschide „Schimbă parola”, introduce parola curentă și parola nouă, apoi confirmă. Acțiunea este opțională și nu există stare obligatorie de schimbare la prima autentificare.

### Dezactivarea și reactivarea

Dezactivarea setează `active = false`, blochează identitatea în Neon Auth și revocă sesiunile existente. Profilul și referințele din audit rămân intacte. Reactivarea setează `active = true` și deblochează identitatea.

Ultimul administrator activ nu poate fi dezactivat, retrogradat sau șters. Utilizatorul curent nu își poate dezactiva propriul cont.

## Interfață

Pagina de autentificare conține doar câmpurile „Nume de utilizator” și „Parolă”, acțiunea „Autentificare” și fluxurile strict necesare panoului intern.

Secțiunea „Personal” afișează pentru fiecare cont numele, username-ul, rolul și starea Activ/Dezactivat. Acțiunile disponibile sunt schimbarea rolului, resetarea parolei, dezactivarea și reactivarea. Crearea și resetarea folosesc dialoguri; confirmarea cu parola afișată o singură dată avertizează administratorul să o copieze înainte de închidere.

## Migrarea conturilor existente

Migrarea adaugă câmpurile noi fără să invalideze imediat sesiunile existente. Administratorul configurat prin `NADIN_ADMIN_EMAILS` primește un username explicit și rămâne activ. Orice alt profil existent primește un username unic controlat sau este dezactivat până când administratorul îl verifică.

Implementarea trebuie să includă un pas repetabil de migrare/backfill și o verificare care refuză lansarea fluxului nou dacă nu există cel puțin un administrator activ cu username. Emailurile tehnice pentru conturile noi nu modifică identitatea administratorului existent decât printr-o operațiune separată și verificată.

## Erori și consistență

- Erorile de validare sunt afișate lângă câmpul relevant.
- Conflictele de username au mesaj explicit pentru administrator.
- Erorile Neon Auth sunt traduse în mesaje românești fără a expune detalii interne.
- Parolele nu apar în loguri, audit, URL-uri sau baza Prisma.
- Acțiunile cu două sisteme aplică compensare când al doilea pas eșuează.
- Dezactivarea locală se face înainte de revocarea externă, astfel încât accesul să fie blocat chiar dacă Neon Auth răspunde temporar cu eroare; interfața semnalează administratorului că sincronizarea trebuie reîncercată.

## Testare și criterii de acceptare

- Pagina și endpointul public de sign-up nu mai permit crearea conturilor.
- Google nu poate acorda acces unei identități care nu are deja un `AppUser` activ.
- Numai `ADMIN` poate crea, reseta, dezactiva și reactiva conturi.
- Un cont nou se poate autentifica prin username și primește rolul selectat.
- Un username duplicat sau invalid este respins.
- Parola nu este persistată sau expusă după închiderea confirmării.
- Resetarea invalidează parola anterioară.
- Un cont dezactivat nu poate începe o sesiune, iar sesiunile existente nu mai pot folosi panoul.
- Reactivarea restaurează accesul cu parola curentă.
- Ultimul administrator activ este protejat la retrogradare și dezactivare.
- O identitate Neon fără `AppUser` activ nu primește acces.
- Administratorul existent își păstrează accesul după migrare.
- Testele existente de roluri, autentificare și personal continuă să treacă.

## În afara scopului

- recuperarea parolei prin email;
- obligarea schimbării parolei la prima autentificare;
- conturi comune pentru mai mulți angajați;
- acordarea automată a accesului prin autentificare socială;
- ștergerea definitivă a conturilor folosite.
