# Cadre de Référence Officiel - Physique (2ème Bac Sciences Physiques BIOF Maroc)

Document de cadrage officiel du Ministère de l'Éducation Nationale pour l'Examen National du Baccalauréat (Filière Sciences Physiques - BIOF).

---

## 1. Ondes Mécaniques & Ondes Lumineuses

### A. Ondes mécaniques progressives et périodiques
- **Onde mécanique progressive** : Propagation d'une perturbation dans un milieu matériel élastique, sans transport de matière mais avec transport d'énergie.
- **Onde transversale** : La perturbation est perpendiculaire à la direction de propagation (ex: onde le long d'une corde, à la surface de l'eau).
- **Onde longitudinale** : La perturbation est parallèle à la direction de propagation (ex: onde sonore et ultrasonore, onde le long d'un ressort).
- **Célérité de l'onde** :
  $$v = \frac{d}{\Delta t} \quad (v \text{ en } \text{m}\cdot\text{s}^{-1}, d \text{ en m}, \Delta t \text{ en s})$$
- **Retard temporel $\tau$** :
  $$\tau = \frac{SM}{v} \quad \implies \quad y_M(t) = y_S(t - \tau)$$
- **Double périodicité des ondes progressives sinusoïdales** :
  - **Périodicité temporelle** : Période $T$ (en $\text{s}$) et fréquence $N = \frac{1}{T}$ (en $\text{Hz}$).
  - **Périodicité spatiale (Longueur d'onde $\lambda$)** : Distance parcourue par l'onde pendant une période temporelle :
    $$\lambda = v \cdot T = \frac{v}{N}$$
  - **Mesure de la période sur oscilloscope** :
    $$T = X \cdot S_h \iff N = \frac{1}{T}$$
    où $X$ est le nombre de divisions horizontales pour une période complète et $S_h$ la sensibilité horizontale (balayage, en $\text{s/div}$, $\text{ms/div}$ ou $\mu\text{s/div}$).
- **État vibratoire de deux points du milieu** :
  - Deux points $M_1$ et $M_2$ distants de $d$ vibrent **en phase** si $d = k \cdot \lambda$ ($k \in \mathbb{N}^*$).
  - Deux points $M_1$ et $M_2$ vibrent **en opposition de phase** si $d = (2k + 1) \frac{\lambda}{2}$ ($k \in \mathbb{N}$).
- **Milieu dispersif** : Milieu matériel dans lequel la célérité $v$ de l'onde dépend de sa fréquence $N$ (ex: la surface de l'eau est dispersive ; l'air pour le son est non dispersif).
- **Phénomène de diffraction des ondes mécaniques** :
  - Se produit lorsqu'une onde plane rencontre une ouverture ou un obstacle de largeur $a$.
  - Condition d'une diffraction nette : $a \le \lambda$ (ou $a \approx \lambda$).
  - Après l'ouverture, l'onde devient circulaire, tout en **conservant strictement sa célérité $v$, sa période $T$, sa fréquence $N$ et sa longueur d'onde $\lambda$**.

### B. Propagation des ondes lumineuses
- **Nature de la lumière** : La lumière est une onde électromagnétique se propageant dans le vide et dans les milieux transparents.
- **Diffraction lumineuse par une fente ou un fil rectiligne** :
  - **Écart angulaire $\theta$** :
    $$\theta = \frac{\lambda}{a} \quad (\theta \text{ en rad}, \lambda \text{ en m}, a \text{ en m})$$
  - **Relation avec la tache centrale sur un écran à distance $D$** :
    $$\tan\theta \approx \theta = \frac{L}{2D} \implies L = \frac{2\lambda D}{a}$$
  - **Exploitation graphique nationale** : La courbe $L = f(1/a)$ est une droite linéaire de pente $k = 2\lambda D$, permettant de déterminer la longueur d'onde $\lambda = \frac{k}{2D}$.
- **Réfraction et dispersion de la lumière** :
  - Indice de réfraction du milieu transparent : $n = \frac{c}{v} \ge 1$ avec $c = 3.00 \times 10^8\text{ m}\cdot\text{s}^{-1}$.
  - Longueur d'onde dans le milieu d'indice $n$ : $\lambda = \frac{\lambda_0}{n}$.
  - **Fréquence invariante** : La fréquence $\nu$ (et la couleur) ne change jamais lors du changement de milieu : $\nu = \frac{c}{\lambda_0} = \frac{v}{\lambda} = \text{constante}$.
  - **Loi de Cauchy** : $n(\lambda) = A + \frac{B}{\lambda^2}$.
  - **Démonstration de la dispersion par un prisme** :
    $$\lambda_{\text{violet}} < \lambda_{\text{rouge}} \implies n_{\text{violet}} > n_{\text{rouge}} \implies D_{\text{violet}} > D_{\text{rouge}}$$
    (Le violet est plus réfracté et plus dévié que le rouge).

---

## 2. Transformations Nucléaires

### A. Décroissance radioactive & Datation
- **Lois de conservation de Soddy** : Pour toute réaction nucléaire ${}_{Z}^{A}X \longrightarrow {}_{Z_1}^{A_1}Y + {}_{Z_2}^{A_2}P$ :
  $$A = A_1 + A_2 \quad (\text{conservation des nucléons}) \quad \text{et} \quad Z = Z_1 + Z_2 \quad (\text{conservation de la charge})$$
- **Les types de désintégrations radioactives** :
  - Émission $\alpha$ : émission d'un noyau d'hélium ${}_{2}^{4}\text{He}$.
  - Émission $\beta^-$ : émission d'un électron ${}_{-1}^{0}e$.
  - Émission $\beta^+$ : émission d'un positon ${}_{+1}^{0}e$.
  - Désexcitation $\gamma$ : émission d'un rayonnement électromagnétique de haute énergie par un noyau fils excité : ${}_{Z}^{A}Y^* \longrightarrow {}_{Z}^{A}Y + \gamma$.
- **Loi de décroissance radioactive** :
  $$N(t) = N_0 \cdot e^{-\lambda t} \quad \text{ou} \quad m(t) = m_0 \cdot e^{-\lambda t}$$
- **Temps de demi-vie $t_{1/2}$ et constante de temps $\tau$** :
  $$t_{1/2} = \frac{\ln 2}{\lambda} \approx \frac{0.693}{\lambda} \quad \text{et} \quad \tau = \frac{1}{\lambda}$$
- **Activité radioactive $a(t)$** :
  $$a(t) = -\frac{dN}{dt} = \lambda \cdot N(t) = a_0 \cdot e^{-\lambda t}$$
  - $a(t)$ en Becquerel ($\text{Bq} = 1\text{ désintégration/seconde}$).
- **Principe de la datation radioactive** :
  $$t = \frac{1}{\lambda} \ln\left(\frac{a_0}{a(t)}\right) = \frac{t_{1/2}}{\ln 2} \ln\left(\frac{a_0}{a(t)}\right)$$

### B. Noyaux, Masse et Énergie
- **Équivalence masse-énergie d'Einstein** : $E = m \cdot c^2$ avec $1\text{ u} = 931.5\text{ MeV}/c^2 = 1.66054 \times 10^{-27}\text{ kg}$.
- **Défaut de masse d'un noyau ${}_{Z}^{A}X$** :
  $$\Delta m = \left[ Z \cdot m_p + (A - Z) m_n \right] - m({}_{Z}^{A}X) > 0$$
- **Énergie de liaison d'un noyau $E_l$** :
  $$E_l = \Delta m \cdot c^2 > 0 \quad (\text{en MeV ou en Joules})$$
- **Énergie de liaison par nucléon & Stabilité (Courbe d'Aston)** :
  $$\xi = \frac{E_l}{A}$$
  - Plus $\xi$ est élevée, plus le noyau est stable (noyaux les plus stables autour de $A \approx 60$, ex: fer $^{56}\text{Fe}$).
- **Bilan énergétique d'une réaction nucléaire** :
  $$\Delta E = \left( \sum m_{\text{produits}} - \sum m_{\text{réactifs}} \right) c^2 = \sum E_{l}(\text{réactifs}) - \sum E_{l}(\text{produits})$$
  - Énergie libérée : $E_{\text{libérée}} = |\Delta E| > 0$.

---

## 3. Électricité : Dipôles RC, RL, RLC & Modulation AM (PC)

### A. Dipôle RC (Charge et Décharge d'un condensateur)
- Relations fondamentales : $q = C \cdot u_C$ et $i = \frac{dq}{dt} = C \frac{du_C}{dt}$.
- **Équation différentielle en charge** :
  $$u_C + R C \frac{du_C}{dt} = E \iff u_C + \tau \frac{du_C}{dt} = E \quad (\text{avec } \tau = RC)$$
- **Solution analytique (Charge)** :
  $$u_C(t) = E \left(1 - e^{-t/\tau}\right) \quad \text{et} \quad i(t) = \frac{E}{R} e^{-t/\tau}$$
  - À $t = \tau$ : $u_C(\tau) = 0.63 E$.
- **Solution analytique (Décharge)** :
  $$u_C(t) = E \cdot e^{-t/\tau} \quad \text{et} \quad i(t) = -\frac{E}{R} e^{-t/\tau}$$
  - À $t = \tau$ : $u_C(\tau) = 0.37 E$.
- **Analyse dimensionnelle** : $[\tau] = [R][C] = \frac{[U]}{[I]} \cdot \frac{[I][T]}{[U]} = [T]$ (durée en secondes).
- **Énergie emmagasinée dans le condensateur** :
  $$\mathcal{E}_e = \frac{1}{2} C u_C^2 = \frac{1}{2} \frac{q^2}{C}$$

### B. Dipôle RL (Établissement et Rupture du courant)
- Tension aux bornes d'une bobine réelle : $u_L = L \frac{di}{dt} + r \cdot i$.
- Rôle de la bobine : Elle s'oppose aux variations d'intensité du courant dans le circuit.
- **Équation différentielle d'établissement du courant** :
  $$L \frac{di}{dt} + (R + r) i = E \iff i + \tau \frac{di}{dt} = I_0 = \frac{E}{R + r} \quad \left(\tau = \frac{L}{R + r}\right)$$
- **Solution analytique** :
  $$i(t) = \frac{E}{R + r} \left(1 - e^{-t/\tau}\right)$$
  - Régime permanent ($t \to \infty$) : $i_\infty = I_0 = \frac{E}{R + r}$ et $u_{L,\infty} = r I_0$.
- **Énergie magnétique emmagasinée dans la bobine** :
  $$\mathcal{E}_m = \frac{1}{2} L i^2$$

### C. Circuit RLC série libre
- **Équation différentielle en tension $u_C$** :
  $$\frac{d^2 u_C}{dt^2} + \frac{R_T}{L} \frac{du_C}{dt} + \frac{1}{LC} u_C = 0 \quad (\text{avec } R_T = R + r)$$
- **Les trois régimes d'oscillation** :
  1. **Régime pseudo-périodique** ($R_T$ faible) : Oscillations amorties de pseudo-période $T \approx T_0 = 2\pi\sqrt{LC}$.
  2. **Régime apériodique** ($R_T$ élevée) : Retour à l'équilibre sans oscillation.
  3. **Régime critique** ($R_T = R_C = 2\sqrt{L/C}$) : Retour le plus rapide à zéro sans osciller.
- **Période propre du circuit LC idéal ($R_T = 0$)** :
  $$T_0 = 2\pi\sqrt{LC} \iff \omega_0 = \frac{1}{\sqrt{LC}}$$
- **Aspect énergétique du circuit RLC** :
  $$\mathcal{E}_T = \mathcal{E}_e + \mathcal{E}_m = \frac{1}{2} C u_C^2 + \frac{1}{2} L i^2$$
  - Dérivée temporelle : $\frac{d\mathcal{E}_T}{dt} = -R_T i^2 \le 0$ (dissipation continue d'énergie par effet Joule).
  - *PIÈGE DU NATIONAL* : La période des échanges d'énergie entre condensateur et bobine vaut $\mathcal{T} = \frac{T}{2}$ (la moitié de la période des tensions) !
- **Entretien des oscillations** : Ajout d'un générateur de résistance négative délivrant $u_G(t) = R_0 \cdot i(t)$.
  - Condition d'oscillations sinusoïdales entretenues : $R_0 = R_T = R + r$.

### D. Modulation d'Amplitude (AM)
- **Principe** : Transmettre un signal informatif basse fréquence $s(t) = S_m \cos(2\pi f_s t)$ sur une onde porteuse haute fréquence $p(t) = P_m \cos(2\pi F_p t)$ avec $F_p \gg f_s$. (Figure au cadre de référence officiel des deux filières PC et SM).
- **Circuit multiplieur & Expression du signal modulé** :
  $$u(t) = k \cdot [s(t) + U_0] \cdot p(t) = A [1 + m \cos(2\pi f_s t)] \cos(2\pi F_p t)$$
  - $U_0$ : Tension continue de décalage (offset).
  - $m$ : Taux de modulation :
    $$m = \frac{S_m}{U_0} = \frac{U_{\max} - U_{\min}}{U_{\max} + U_{\min}}$$
- **Conditions de bonne modulation** :
  1. $m < 1$ (pas de surmodulation, évite l'inversion de phase).
  2. $F_p \ge 10 f_s$ (la fréquence porteuse est nettement supérieure à la fréquence du signal).
- **Spectre de fréquences du signal modulé** : Composé de 3 raies fréquentielles :
  $$F_p - f_s, \quad F_p, \quad F_p + f_s \implies \text{Largeur de bande : } \Delta F = 2 f_s$$
- **Démodulation d'amplitude (Récepteur AM)** :
  1. **Détection d'enveloppe** (diode + circuit RC parallèle) : Condition de bonne détection :
     $$T_p \ll \tau = RC < T_s \iff \frac{1}{F_p} \ll RC < \frac{1}{f_s}$$
  2. **Filtre éliminateur de la composante continue** (circuit RC série passe-haut) : Bloque la tension continue $U_0$ pour restituer le signal informatif $s(t)$.
  3. **Circuit bouchon LC parallèle** (sélection de la station par résonance) : $f_0 = \frac{1}{2\pi\sqrt{LC}} = F_p$.

---

## 4. Mécanique

### A. Lois de Newton & Chute verticale dans un fluide
- **Les 3 Lois de Newton** :
  1. Principe d'inertie (1ère loi) : $\sum \vec{F}_{ext} = \vec{0} \iff \vec{v}_G = \vec{\text{cte}}$.
  2. Relation fondamentale de la dynamique (2ème loi) : $\sum \vec{F}_{ext} = m \cdot \vec{a}_G$.
  3. Principe des actions réciproques (3ème loi) : $\vec{F}_{A/B} = -\vec{F}_{B/A}$.
- **Structure de rédaction obligatoire au barème national** :
  1. Système étudié.
  2. Référentiel d'étude (supposé galiléen).
  3. Bilan complet des forces extérieures appliquées.
- **Chute verticale d'un solide dans un fluide visqueux** :
  - Forces : Poids $\vec{P} = m\vec{g}$, Poussée d'Archimède $\vec{F}_A = -\rho_f V g \vec{j}$, Force de frottement fluide $\vec{f} = -k v^n \vec{j}$ ($n=1$ à faible vitesse, $n=2$ à grande vitesse).
  - Équation différentielle :
    $$\frac{dv}{dt} + \frac{k}{m} v^n = g \left(1 - \frac{\rho_f}{\rho_s}\right) \iff \frac{dv}{dt} = A - B v^n$$
  - Accélération initiale : $a_0 = A = g\left(1 - \frac{\rho_f}{\rho_s}\right)$.
  - Vitesse limite : Quand $t \to \infty$, $\frac{dv}{dt} = 0 \implies v_{lim} = \left(\frac{A}{B}\right)^{1/n}$.
  - Temps caractéristique : $\tau = \frac{v_{lim}}{a_0}$.
- **Méthode d'Euler (Résolution numérique pas à pas)** :
  $$a_i = A - B v_i^n \quad \text{puis} \quad v_{i+1} = v_i + a_i \cdot \Delta t$$
  (Le pas de calcul $\Delta t$ doit respecter $\Delta t \ll \tau$).
- **Mouvement sur plan horizontal et plan incliné** :
  - Décomposition du poids et de la réaction du support : $\vec{R} = \vec{R}_N + \vec{f}$.
  - Coefficient de frottement : $\tan\varphi = \frac{f}{R_N}$.

### B. Mouvements de Projectiles & Déflexion Magnétique (Champ B)
- **Mouvement d'un projectile dans un champ de pesanteur uniforme $\vec{g}$** :
  - Équations horaires de la vitesse : $v_x(t) = v_0 \cos\alpha$ et $v_y(t) = -gt + v_0 \sin\alpha$.
  - Équations horaires de position :
    $$x(t) = (v_0 \cos\alpha) t \quad \text{et} \quad y(t) = -\frac{1}{2} g t^2 + (v_0 \sin\alpha) t + y_0$$
  - Équation de la trajectoire parabolique :
    $$y(x) = -\frac{g}{2 v_0^2 \cos^2\alpha} x^2 + (\tan\alpha) x + y_0$$
  - Flèche (sommet $S$, $v_y = 0$) : $y_S = \frac{v_0^2 \sin^2\alpha}{2g} + y_0$.
  - Portée (impact $y_P = 0$) : $x_P = \frac{v_0^2 \sin(2\alpha)}{g}$ (si $y_0 = 0$).
- **Particule chargée dans un champ magnétique uniforme $\vec{B}$ (Force de Lorentz - Commun PC et SM)** :
  - Force de Lorentz magnétique : $\vec{F} = q \cdot (\vec{v} \wedge \vec{B})$ avec $\vec{v}_0 \perp \vec{B}$.
  - Propriété fondamentale : $\vec{F} \perp \vec{v} \implies$ puissance mécanique $\mathcal{P} = \vec{F} \cdot \vec{v} = 0 \implies$ travail nul $\implies$ l'énergie cinétique est constante, le mouvement est donc **uniforme** ($v = v_0 = \text{cte}$).
  - Accélération normale dans le repère de Frenet : $a_n = \frac{v^2}{R} = \frac{|q| v B}{m}$.
  - Trajectoire circulaire plane de rayon :
    $$R = \frac{m \cdot v}{|q| \cdot B}$$
  - Période et vitesse angulaire : $T = \frac{2\pi R}{v} = \frac{2\pi m}{|q| B}$.
  - Déflexion magnétique : mesure sur écran distant $D_m \approx \frac{q B L L'}{m v}$.
  - ⚠️ *Précision du Cadre de Référence Officiel* : Le champ électrique uniforme $\vec{E}$ ($\vec{F} = q\vec{E}$, $E = U/d$, déflexion électrostatique) est au programme des **Sciences Mathématiques (SM)** mais **ne figure pas au cadre de référence de Sciences Physiques (PC)**.

### C. Mouvement des Satellites et des Planètes (Lois de Kepler)
- **Les 3 Lois de Kepler (Communes PC et SM)** :
  1. Loi des orbites : Les orbites des planètes sont des ellipses dont le Soleil occupe l'un des foyers.
  2. Loi des aires : Le rayon vecteur balaie des aires égales pendant des durées égales.
  3. Loi des périodes : Le rapport du carré de la période de révolution au cube du demi-grand axe est constant : $\frac{T^2}{a^3} = \text{cte}$.
- **Mouvement circulaire uniforme d'un satellite ($a = r$)** :
  - Force gravitationnelle centripète : $F = G \frac{M \cdot m}{r^2} = m \frac{v^2}{r}$.
  - Vitesse orbitale : $v = \sqrt{\frac{G M}{r}}$.
  - Période orbitale : $T = \frac{2\pi r}{v} = 2\pi \sqrt{\frac{r^3}{G M}} \implies \frac{T^2}{r^3} = \frac{4\pi^2}{G M}$.
  - Satellite géostationnaire : Période $T \approx 86164\text{ s}$ ($\approx 24\text{ h}$), orbite circulaire équatoriale, sens de rotation identique à la rotation propre de la Terre.

### D. Rotation d'un solide autour d'un axe fixe ($\Delta$) (Commun PC et SM)
- **Repérage angulaire & Cinématique** :
  - Abscisse angulaire $\theta(t)$, vitesse angulaire $\dot{\theta} = \omega = \frac{d\theta}{dt}$, accélération angulaire $\ddot{\theta} = \alpha = \frac{d^2\theta}{dt^2}$.
  - Relations avec les grandeurs linéaires d'un point à distance $r$ de l'axe :
    $$s(t) = r \cdot \theta(t), \quad v(t) = r \cdot \dot{\theta}(t), \quad a_T = r \cdot \ddot{\theta}(t), \quad a_N = r \cdot \dot{\theta}^2(t) = \frac{v^2}{r}$$
- **Relation fondamentale de la dynamique en rotation (RFD)** :
  $$\sum M_\Delta(\vec{F}_{\text{ext}}) = J_\Delta \cdot \ddot{\theta}$$
  - $J_\Delta$ : Moment d'inertie du solide par rapport à l'axe $\Delta$ (en $\text{kg}\cdot\text{m}^2$).
  - Mouvement de rotation uniformément varié ($\ddot{\theta} = \text{cte}$) :
    $$\dot{\theta}(t) = \ddot{\theta} \cdot t + \dot{\theta}_0 \quad \text{et} \quad \theta(t) = \frac{1}{2}\ddot{\theta} \cdot t^2 + \dot{\theta}_0 \cdot t + \theta_0$$
    $$\dot{\theta}_2^2 - \dot{\theta}_1^2 = 2 \ddot{\theta} (\theta_2 - \theta_1)$$
- **Système couplé translation-rotation** :
  - Couplage d'un solide en translation (masse $m$) et d'une poulie en rotation (moment d'inertie $J_\Delta$) par un fil inextensible et sans masse.
  - Condition de non-glissement du fil sur la poulie : $a = r \cdot \ddot{\theta}$.

### E. Systèmes Mécaniques Oscillants & Pendules (Commun PC et SM)
- **1. Pendule élastique (Solide-Ressort horizontal, incliné ou vertical)** :
  - Force de rappel : $\vec{T} = -k x \vec{i}$.
  - Équation différentielle : $\ddot{x} + \frac{k}{m} x = 0 \implies T_0 = 2\pi\sqrt{\frac{m}{k}}$.
  - Énergie mécanique : $E_m = \frac{1}{2} m \dot{x}^2 + \frac{1}{2} k x^2 = \text{constante}$.
- **2. Pendule de torsion (Présent au cadre officiel PC et SM)** :
  - Couple de rappel exercé par le fil métallique : $M_c = -C \cdot \theta$ ($C$ en $\text{N}\cdot\text{m}\cdot\text{rad}^{-1}$).
  - Équation différentielle non amortie :
    $$J_\Delta \ddot{\theta} + C \theta = 0 \implies T_0 = 2\pi\sqrt{\frac{J_\Delta}{C}}$$
  - Énergie potentielle de torsion : $E_{pt} = \frac{1}{2} C \theta^2 \implies E_m = \frac{1}{2} J_\Delta \dot{\theta}^2 + \frac{1}{2} C \theta^2 = \text{cte}$.
- **3. Pendule pesant & Pendule simple synchrone (Présent au cadre officiel PC et SM)** :
  - Pendule pesant : Solide en rotation autour d'un axe horizontal $\Delta$ ne passant pas par son centre de gravité $G$ ($d = OG$).
  - Moment du poids : $M_\Delta(\vec{P}) = -m g d \sin\theta$.
  - Équation différentielle aux faibles oscillations ($\sin\theta \approx \theta$ en rad) :
    $$J_\Delta \ddot{\theta} + m g d \theta = 0 \implies T_0 = 2\pi\sqrt{\frac{J_\Delta}{m g d}}$$
  - Pendule simple synchrone de longueur $\ell$ ($J_\Delta = m \ell^2$, $d = \ell$) :
    $$T_0 = 2\pi\sqrt{\frac{\ell}{g}}$$
- **4. Résonance mécanique (Présent au cadre officiel PC et SM)** :
  - Excitateur imposant des oscillations périodiques à un résonateur.
  - Phénomène de résonance mécanique : amplitude maximale obtenue pour une fréquence d'excitation proche de la fréquence propre.
  - Rôle de l'amortissement : abaisse le pic de résonance et décale légèrement la fréquence de résonance.
- **5. Aspects énergétiques des oscillateurs** :
  - Travail d'une force de rappel élastique : $W = -\Delta E_{pe} = \frac{1}{2} k (x_1^2 - x_2^2)$.
  - Travail d'un couple de torsion : $W = -\Delta E_{pt} = \frac{1}{2} C (\theta_1^2 - \theta_2^2)$.
  - Travail du poids : $W = -\Delta E_{pp} = m g d (\cos\theta_2 - \cos\theta_1)$.

---

## 5. L'Atome et la Mécanique de Newton (Modèle de Bohr)

- **Postulats de Bohr** :
  - L'énergie de l'atome est quantifiée : elle ne peut prendre que des valeurs discrètes $E_n$.
  - Niveaux d'énergie de l'atome d'hydrogène :
    $$E_n = -\frac{E_0}{n^2} = -\frac{13.6}{n^2} \text{ eV} \quad (n \in \mathbb{N}^*)$$
  - État fondamental : $n = 1 \implies E_1 = -13.6\text{ eV}$.
  - États excités : $n > 1$.
  - État ionisé : $n \to \infty \implies E_\infty = 0\text{ eV}$ ($E_{\text{ionisation}} = 13.6\text{ eV}$).
- **Relation de Planck-Einstein lors d'une transition entre deux niveaux $p$ et $n$ ($p > n$)** :
  $$\Delta E = E_p - E_n = h \cdot \nu = \frac{h \cdot c}{\lambda}$$
  - $h = 6.626 \times 10^{-34}\text{ J}\cdot\text{s}$ (constante de Planck).
  - Émission d'un photon si le système passe d'un niveau supérieur à un niveau inférieur.
  - Absorption d'un photon si le système passe d'un niveau inférieur à un niveau supérieur.
  - Conversion d'énergie indispensable : $1\text{ eV} = 1.602 \times 10^{-19}\text{ J}$.
