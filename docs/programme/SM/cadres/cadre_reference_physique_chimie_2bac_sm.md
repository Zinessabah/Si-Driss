# Cadre de Référence Officiel - Physique-Chimie (2ème Bac Sciences Mathématiques A & B - BIOF Maroc)

Document de cadrage officiel du Ministère de l'Éducation Nationale pour l'Examen National du Baccalauréat (Filière Sciences Mathématiques - A et B - BIOF).

---

## 1. Ondes Mécaniques & Ondes Lumineuses

### A. Ondes mécaniques progressives et périodiques
- **Onde mécanique progressive** : Propagation d'une perturbation dans un milieu matériel élastique, sans transport de matière mais avec transport d'énergie.
- **Onde transversale et longitudinale** :
  - Transversale : perturbation perpendiculaire à la direction de propagation (corde, surface de l'eau).
  - Longitudinale : perturbation parallèle à la direction de propagation (son, ressort).
- **Célérité de l'onde** : $v = \frac{d}{\Delta t}$ ($v$ en $\text{m}\cdot\text{s}^{-1}$, $d$ en $\text{m}$, $\Delta t$ en $\text{s}$).
- **Retard temporel $\tau$** : $\tau = \frac{SM}{v}$ avec relation d'élongation $y_M(t) = y_S(t - \tau)$.
- **Double périodicité des ondes sinusoïdales** :
  - Temporelle : période $T$ ($\text{s}$) et fréquence $N = \frac{1}{T}$ ($\text{Hz}$).
  - Spatiale : longueur d'onde $\lambda = v \cdot T = \frac{v}{N}$.
  - Mesure sur oscilloscope : $T = X \cdot S_h \iff N = \frac{1}{T}$ ($S_h$ en $\text{s/div}$, $\text{ms/div}$ ou $\mu\text{s/div}$).
- **État vibratoire de deux points distants de $d$** :
  - En phase si $d = k \cdot \lambda$ ($k \in \mathbb{N}^*$).
  - En opposition de phase si $d = (2k + 1) \frac{\lambda}{2}$ ($k \in \mathbb{N}$).
- **Milieu dispersif** : Milieu où la célérité $v$ dépend de la fréquence $N$.
- **Diffraction des ondes mécaniques** : $a \le \lambda \implies$ onde circulaire centrée sur la fente, avec conservation de $v$, $T$, $N$ et $\lambda$.

### B. Ondes lumineuses (Diffraction & Réfraction)
- **Nature ondulatoire** : Onde électromagnétique transversale se propageant dans le vide à $c = 3.00 \times 10^8\text{ m}\cdot\text{s}^{-1}$.
- **Diffraction par une fente ou un fil de largeur $a$** :
  $$\theta = \frac{\lambda}{a} \quad \text{et} \quad \tan\theta \approx \theta = \frac{L}{2D} \implies L = \frac{2\lambda D}{a}$$
- **Réfraction et dispersion** : $n = \frac{c}{v} \ge 1$, $\lambda = \frac{\lambda_0}{n}$, $\nu = \text{constante}$. Loi de Cauchy : $n(\lambda) = A + \frac{B}{\lambda^2} \implies D_{\text{violet}} > D_{\text{rouge}}$.

---

## 2. Transformations Nucléaires

- **Lois de conservation de Soddy** : Conservation du nombre de nucléons $A$ et de la charge $Z$.
- **Loi de décroissance radioactive** : $N(t) = N_0 \cdot e^{-\lambda t}$ avec $t_{1/2} = \frac{\ln 2}{\lambda} = \tau \ln 2$.
- **Activité radioactive** : $a(t) = -\frac{dN}{dt} = \lambda N(t) = a_0 e^{-\lambda t}$ ($a$ en $\text{Bq}$). Datation : $t = \frac{1}{\lambda}\ln\left(\frac{a_0}{a(t)}\right)$.
- **Énergie de masse & Défaut de masse** : $\Delta m = \left[Z m_p + (A-Z) m_n\right] - m({}_{Z}^{A}X) > 0$.
- **Énergie de liaison $E_l$ & Stabilité par nucléon** :
  $$E_l = \Delta m \cdot c^2 > 0 \quad \text{et} \quad \xi = \frac{E_l}{A} \quad (\text{Courbe d'Aston})$$
- **Bilan énergétique d'une réaction** : $\Delta E = \left(\sum m_{\text{produits}} - \sum m_{\text{réactifs}}\right) c^2 \implies E_{\text{libérée}} = |\Delta E|$.

---

## 3. Électricité : Dipôles RC, RL, RLC Libre, RLC Forcé (Exclusif SM) et Modulation AM

### A. Dipôles RC et RL (Communs PC et SM)
- **Condensateur (RC)** : $q = C u_C$, $i = C \frac{du_C}{dt}$. Équation de charge : $u_C + \tau \frac{du_C}{dt} = E$ avec $\tau = RC$. Énergie $\mathcal{E}_e = \frac{1}{2} C u_C^2$.
- **Bobine (RL)** : $u_L = L \frac{di}{dt} + r i$. Équation d'établissement : $i + \tau \frac{di}{dt} = \frac{E}{R+r}$ avec $\tau = \frac{L}{R+r}$. Énergie $\mathcal{E}_m = \frac{1}{2} L i^2$.

### B. Circuit RLC série libre (Commun PC et SM)
- Équation différentielle : $\frac{d^2u_C}{dt^2} + \frac{R_t}{L} \frac{du_C}{dt} + \frac{1}{LC} u_C = 0$. Période propre : $T_0 = 2\pi\sqrt{LC}$.
- Énergie totale : $\mathcal{E}_T = \frac{1}{2} C u_C^2 + \frac{1}{2} L i^2 \implies \frac{d\mathcal{E}_T}{dt} = -R_t i^2 \le 0$. Période des énergies : $\mathcal{T} = T/2$.
- Entretien des oscillations par générateur de résistance négative : $u_G = R_0 i \implies R_0 = R_t$.

### C. EXCLUSIF SCIENCES MATHÉMATIQUES : Oscillations électriques forcées RLC série
*(Ce chapitre figure au cadre de référence SM mais est ABSENT du cadre PC)*
- **Régime sinusoïdal forcé** : Excitateur GBF imposant $u(t) = U_m \cos(\omega t)$, réponse du résonateur $i(t) = I_m \cos(\omega t - \varphi)$.
- **Impédance du dipôle RLC** :
  $$Z = \frac{U_m}{I_m} = \frac{U}{I} = \sqrt{R_t^2 + \left(L\omega - \frac{1}{C\omega}\right)^2}$$
- **Déphasage $\varphi = \varphi_u - \varphi_i$ (Diagramme de Fresnel)** :
  $$\tan\varphi = \frac{L\omega - \frac{1}{C\omega}}{R_t} \quad \text{et} \quad \cos\varphi = \frac{R_t}{Z}$$
  - Si $L\omega > \frac{1}{C\omega}$ : Circuit inductif ($\varphi > 0$, tension en avance sur le courant).
  - Si $L\omega < \frac{1}{C\omega}$ : Circuit capacitif ($\varphi < 0$, tension en retard sur le courant).
- **Résonance d'intensité** :
  - Condition : $L\omega_0 - \frac{1}{C\omega_0} = 0 \iff \omega_0 = \frac{1}{\sqrt{LC}} \iff N_0 = \frac{1}{2\pi\sqrt{LC}}$.
  - À la résonance : $Z_{\min} = R_t$, l'intensité est maximale $I_0 = \frac{U}{R_t}$ et $\varphi = 0$ (en phase).
- **Facteur de qualité $Q$ et Surtension** :
  $$Q = \frac{L\omega_0}{R_t} = \frac{1}{R_t C \omega_0} = \frac{1}{R_t}\sqrt{\frac{L}{C}}$$
  - Tension aux bornes du condensateur à la résonance : $U_{C,0} = Q \cdot U$. Si $Q > 1$, il y a **surtension**.
- **Bande passante à $-3\text{ dB}$** :
  - Définie par $I \ge \frac{I_0}{\sqrt{2}}$ entre les fréquences de coupure $N_1$ et $N_2$.
  - Largeur de bande passante :
    $$\Delta N = N_2 - N_1 = \frac{R_t}{2\pi L} = \frac{N_0}{Q}$$
- **Puissance en régime alternatif** :
  - Puissance instantanée : $p(t) = u(t) \cdot i(t)$.
  - Puissance moyenne : $P = U \cdot I \cdot \cos\varphi$ ($\cos\varphi$ étant le facteur de puissance).

### D. Modulation d'Amplitude AM (Commune PC et SM)
- Transmission d'information : porteuse HF $p(t) = P_m \cos(2\pi F_p t)$ modulée par $s(t) + U_0$.
- Signal modulé : $u(t) = k [s(t) + U_0] p(t) = A [1 + m \cos(2\pi f_s t)] \cos(2\pi F_p t)$.
- Taux de modulation : $m = \frac{S_m}{U_0} = \frac{U_{\max} - U_{\min}}{U_{\max} + U_{\min}}$ (condition sans surmodulation : $m < 1$ et $F_p \gg f_s$).
- Démodulation : Détecteur d'enveloppe ($\frac{1}{F_p} \ll RC < \frac{1}{f_s}$) et filtre passe-haut d'élimination de composante continue.
- Sélection par circuit bouchon LC parallèle accordé à la fréquence porteuse : $F_0 = \frac{1}{2\pi\sqrt{LC}} = F_p$.

---

## 4. Mécanique (Commune à 95% avec PC)

### A. Lois de Newton, Chute dans un fluide & Projectiles (Communs PC et SM)
- 2ème loi de Newton : $\sum \vec{F}_{ext} = m \cdot \vec{a}_G$ dans un référentiel galiléen.
- Chute verticale avec frottement visqueux : $\frac{dv}{dt} + \frac{k}{m} v^n = g\left(1 - \frac{\rho_f}{\rho_s}\right)$, vitesse limite $v_{lim}$, algorithme d'Euler.
- Mouvement des projectiles dans le champ $\vec{g}$ : équations horaires, trajectoire parabolique, flèche et portée.
- Mouvement des satellites et planètes : 3 lois de Kepler, vitesse $v = \sqrt{\frac{GM}{r}}$, période $T = 2\pi\sqrt{\frac{r^3}{GM}}$.

### B. Mouvement d'une particule chargée dans les champs
- **EXCLUSIF SCIENCES MATHÉMATIQUES : Particule chargée dans un champ électrique uniforme $\vec{E}$** :
  *(Présent en SM, absent du cadre de référence PC)*
  - Force électrostatique : $\vec{F}_e = q \cdot \vec{E}$ avec $E = \frac{U}{d}$.
  - Accélération : $\vec{a} = \frac{q}{m} \vec{E}$.
  - Déflexion électrostatique : établissement des équations horaires, équation de trajectoire parabolique et calcul de la déflexion sur écran.
- **Particule chargée dans un champ magnétique uniforme $\vec{B}$ (Commun PC et SM)** :
  - Force de Lorentz magnétique : $\vec{F} = q (\vec{v} \wedge \vec{B})$ avec $\vec{v}_0 \perp \vec{B}$.
  - $\vec{F} \perp \vec{v} \implies$ travail nul $\implies$ énergie cinétique constante $\implies$ mouvement uniforme ($v = \text{cte}$).
  - Trajectoire circulaire dans le plan orthogonal à $\vec{B}$, de rayon orbital :
    $$R = \frac{m \cdot v}{|q| \cdot B}$$
  - Calcul de la déflexion magnétique.

### C. Rotation d'un solide autour d'un axe fixe (Commun PC et SM)
- **Relation Fondamentale de la Dynamique en rotation (RFD)** :
  $$\sum M_\Delta(\vec{F}_{ext}) = J_\Delta \cdot \ddot{\theta} = J_\Delta \cdot \alpha$$
  - $J_\Delta$ : Moment d'inertie du solide par rapport à l'axe $\Delta$ (en $\text{kg}\cdot\text{m}^2$).
  - $\ddot{\theta} = \frac{d^2\theta}{dt^2}$ : Accélération angulaire (en $\text{rad}\cdot\text{s}^{-2}$).
  - Moment d'une force orthogonale : $M_\Delta(\vec{F}) = \pm F \cdot d$.
- **Énergie cinétique de rotation** :
  $$E_{c,rot} = \frac{1}{2} J_\Delta \dot{\theta}^2 = \frac{1}{2} J_\Delta \omega^2$$
- **Théorème de l'énergie cinétique en rotation** :
  $$\Delta E_c = \frac{1}{2} J_\Delta \dot{\theta}_2^2 - \frac{1}{2} J_\Delta \dot{\theta}_1^2 = \sum W_\Delta(\vec{F}_{ext}) = \sum M_\Delta \cdot \Delta\theta$$
- **Conditions de non-glissement d'un fil sur une poulie de rayon $R$** :
  $$s(t) = R \cdot \theta(t), \quad v(t) = R \cdot \dot{\theta}(t), \quad a(t) = R \cdot \ddot{\theta}(t)$$

### D. Systèmes Mécaniques Oscillants & Pendules (Communs PC et SM)
- **1. Pendule élastique (horizontal, incliné, vertical)** :
  - Équation différentielle : $\ddot{x} + \frac{k}{m} x = 0 \implies T_0 = 2\pi\sqrt{\frac{m}{k}}$.
  - Énergie mécanique : $E_m = \frac{1}{2} m \dot{x}^2 + \frac{1}{2} k x^2 = \text{constante}$.
- **2. Pendule de torsion (Commun PC et SM)** :
  - Couple de rappel de torsion : $M_c = -C \cdot \theta$ ($C$ constante de torsion en $\text{N}\cdot\text{m}\cdot\text{rad}^{-1}$).
  - Équation différentielle non amortie :
    $$J_\Delta \ddot{\theta} + C \theta = 0 \implies T_0 = 2\pi\sqrt{\frac{J_\Delta}{C}}$$
  - Énergie potentielle de torsion : $E_{pt} = \frac{1}{2} C \theta^2 \implies E_m = \frac{1}{2} J_\Delta \dot{\theta}^2 + \frac{1}{2} C \theta^2 = \text{cte}$.
- **3. Pendule pesant et Pendule simple synchrone (Commun PC et SM)** :
  - Équation différentielle aux petites oscillations ($\sin\theta \approx \theta$) :
    $$J_\Delta \ddot{\theta} + m g d \theta = 0 \implies T_0 = 2\pi\sqrt{\frac{J_\Delta}{m g d}}$$
  - Pour le pendule simple synchrone de longueur $\ell$ ($J_\Delta = m \ell^2$, $d = \ell$) :
    $$T_0 = 2\pi\sqrt{\frac{\ell}{g}}$$
- **4. Oscillations mécaniques forcées et résonance mécanique (Commun PC et SM)** :
  - Excitateur imposant une force $F(t) = F_m \cos(\omega t)$ à un résonateur de pulsation propre $\omega_0 = \sqrt{k/m}$.
  - Résonance d'amplitude : pic d'amplitude pour une fréquence proche de $N_0$ ; l'amortissement décale et aplatit le pic.
- **5. Aspects énergétiques des oscillateurs** :
  - Travail du ressort, du couple de torsion et du poids.

### E. Modèle de Bohr de l'atome (Commun PC et SM)
- Énergie quantifiée : $E_n = -\frac{13.6}{n^2}\text{ eV}$.
- Relation de Planck-Einstein : $\Delta E = h \nu = \frac{h c}{\lambda}$ ($1\text{ eV} = 1.602 \times 10^{-19}\text{ J}$).

---

## 5. Chimie pour Sciences Mathématiques (Conforme au Cadre de Référence SM)

### A. Cinétique chimique & Suivi temporel officiel marocain
- Vitesse volumique de réaction : $v(t) = \frac{1}{V_S} \frac{dx}{dt}$.
- Temps de demi-réaction : $x(t_{1/2}) = x_f / 2$.
- **Les 5 techniques officielles du cadre marocain** :
  1. Mesure de pression : $P V = n R T \implies x(t) = \frac{\Delta P(t) V}{R T}$.
  2. Mesure de volume de gaz : $V_{\text{gaz}}(t) = n(t) \cdot V_m \implies x(t) = \frac{V_{\text{gaz}}(t)}{V_m}$.
  3. Conductimétrie : $\sigma(t) = \sum \lambda_i [X_i](t)$ avec $[X_i]$ impérativement en $\mathbf{mol\cdot m^{-3}}$.
  4. pH-métrie : $[H_3O^+] = 10^{-pH}$.
  5. Titrage avec trempe thermique à l'eau glacée.
- ⚠️ *Note* : La spectrophotométrie et la loi de Beer-Lambert sont absentes du cadre de référence marocain.

### B. Équilibres chimiques & Réactions acido-basiques
- Taux d'avancement final $\tau = x_f / x_{max}$ ($\tau < 1 \iff$ transformation limitée).
- Quotient de réaction $Q_r$ (solutés aqueux uniquement) et constante $K = Q_{r,eq}$ (ne dépend que de $T$).
- Produit ionique $K_e = [H_3O^+][HO^-] = 10^{-14}$ ($25^\circ\text{C}$).
- Constante d'acidité $K_A = \frac{[A^-]_{eq}[H_3O^+]_{eq}}{[AH]_{eq}}$ et $pH = pK_A + \log\frac{[A^-]_{eq}}{[AH]_{eq}}$.
- Titrage acido-basique : équivalence $C_A V_A = C_B V_{bE}$, demi-équivalence $pH = pK_A$.

### C. Évolution spontanée & Piles électrochimiques
- Critère d'évolution spontanée : comparaison de $Q_{r,i}$ et $K$.
- Pile : Anode ($\ominus$) = Oxydation ; Cathode ($\oplus$) = Réduction.
- Quantité d'électricité : $Q = I \Delta t = n(e^-) \cdot \mathcal{F} = z \cdot x \cdot \mathcal{F}$ ($\mathcal{F} \approx 96500\text{ C}\cdot\text{mol}^{-1}$).

### D. Transformations forcées : Électrolyse
- Générateur imposant le sens inverse ($Q_{r,i} > K$).
- Anode reliée au pôle $(+)$ (oxydation), Cathode reliée au pôle $(-)$ (réduction).

### E. Chimie organique : Estérification, Hydrolyse, Saponification
- Estérification : $R-COOH + R'-OH \rightleftharpoons R-COO-R' + H_2O$ (lente, athermique, limitée).
  - L'eau est un produit et figure dans $K = \frac{[ester][eau]}{[acide][alcool]}$.
  - Rendement équimolaire : alcool $I^\circ \implies 67\%$, alcool $II^\circ \implies 60\%$, alcool $III^\circ \implies 5\%$.
- Amélioration : catalyseur $H_2SO_4$ et chauffage à reflux (vitesse) ; réactif en excès ou élimination de l'eau (rendement).
- Anhydride d'acide : $(R-CO)_2O + R'-OH \longrightarrow R-COO-R' + R-COOH$ (rapide, totale, $r=100\%$).
- Saponification : $R-COO-R' + HO^- \longrightarrow R-COO^- + R'-OH$ (lente à froid, totale).
