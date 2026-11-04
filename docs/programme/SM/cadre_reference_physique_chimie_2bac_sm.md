# Cadre de Référence Officiel - Physique-Chimie (2ème Bac Sciences Mathématiques A & B - BIOF Maroc)

Ce document constitue le référentiel officiel exhaustif pour l'Examen National marocain du Baccalauréat en section Sciences Mathématiques (A et B).

---

## 1. Ondes Mécaniques & Lumineuses
- **Onde mécanique progressive** : Phénomène de propagation d'une perturbation dans un milieu matériel élastique sans transport de matière mais avec transport d'énergie.
- **Onde transversale** : Direction de déformation perpendiculaire à la direction de propagation.
- **Onde longitudinale** : Direction de déformation parallèle à la direction de propagation.
- **Retard temporel $\tau$** : $\tau = \frac{SM}{v}$ avec $y_M(t) = y_S(t - \tau)$.
- **Double périodicité** : Périodicité spatiale $\lambda = v \cdot T = \frac{v}{N}$ et temporelle $T = \frac{1}{N}$.
- **Milieu dispersif** : Milieu où la célérité dépend de la fréquence $N$.
- **Diffraction des ondes lumineuses** :
  - Écart angulaire : $\theta = \frac{\lambda}{a}$ (avec $\theta$ en rad, $\lambda$ en m, $a$ en m).
  - Tache centrale de largeur $L$ sur un écran à distance $D$ : $\tan\theta \approx \theta = \frac{L}{2D} \implies L = \frac{2\lambda D}{a}$.
  - Réfraction et dispersion : indice de réfraction $n = \frac{c}{v} \ge 1$, loi de Cauchy $n(\lambda) = A + \frac{B}{\lambda^2}$.

---

## 2. Transformations Nucléaires
- **Lois de conservation de Soddy** : Conservation du nombre total de nucléons $A$ et de la charge $Z$.
- **Décroissance radioactive** : $N(t) = N_0 e^{-\lambda t}$, $a(t) = \lambda N(t) = a_0 e^{-\lambda t}$.
- **Constante radioactive et demi-vie** : $\tau = \frac{1}{\lambda}$, $t_{1/2} = \frac{\ln 2}{\lambda} = \tau \ln 2$.
- **Énergie de masse et défaut de masse** : $\Delta m = Z m_p + (A-Z) m_n - m(X) > 0$.
- **Énergie de liaison d'un noyau** : $E_l = \Delta m \cdot c^2$.
- **Énergie de liaison par nucléon** : $\frac{E_l}{A}$ (critère de stabilité, courbe d'Aston).
- **Bilan énergétique d'une réaction** : $\Delta E = \left(\sum m_{produits} - \sum m_{reactifs}\right) c^2$. Énergie libérée : $E_{lib} = |\Delta E|$.

---

## 3. Électricité (Dipôles RC, RL, RLC Libre et RLC Série Forcé)
### A. Dipôles RC et RL
- **Condensateur (RC)** : $q = C u_C$, $i = \frac{dq}{dt} = C \frac{du_C}{dt}$. Charge : $u_C + RC \frac{du_C}{dt} = E \implies \tau = RC$.
- **Bobine (RL)** : $u_L = L \frac{di}{dt} + r i$. Établissement : $i + \frac{L}{R+r} \frac{di}{dt} = \frac{E}{R+r} \implies \tau = \frac{L}{R_t}$.

### B. Circuit RLC série libre
- Équation différentielle en tension : $\frac{d^2u_C}{dt^2} + \frac{R_t}{L} \frac{du_C}{dt} + \frac{1}{LC} u_C = 0$.
- Période propre : $T_0 = 2\pi\sqrt{LC}$ (régime pseudo-périodique : pseudo-période $T \approx T_0$).
- Énergie totale : $\mathcal{E}_T = \frac{1}{2} C u_C^2 + \frac{1}{2} L i^2$. Dérivée : $\frac{d\mathcal{E}_T}{dt} = -R_t i^2 \le 0$ (dissipation par effet Joule).
- Entretien des oscillations : dipôle d'entretien à résistance négative $u_g = R_0 i$ compensant les pertes ($R_0 = R_t$).

### C. SPÉCIFIQUE SCIENCES MATHÉMATIQUES : Oscillations électriques forcées RLC série
- **Régime sinusoïdal forcé** : Générateur GBF imposant $u(t) = U_m \cos(\omega t)$ (excitateur), réponse du circuit $i(t) = I_m \cos(\omega t - \varphi)$ (résonateur).
- **Impédance du dipôle RLC** :
  $$Z = \frac{U_m}{I_m} = \frac{U}{I} = \sqrt{R_t^2 + \left(L\omega - \frac{1}{C\omega}\right)^2}$$
- **Déphasage $\varphi = \varphi_u - \varphi_i$** :
  $$\tan\varphi = \frac{L\omega - \frac{1}{C\omega}}{R_t} \quad \text{et} \quad \cos\varphi = \frac{R_t}{Z}$$
  - Si $L\omega > \frac{1}{C\omega}$ : circuit inductif ($\varphi > 0$, $u(t)$ en avance sur $i(t)$).
  - Si $L\omega < \frac{1}{C\omega}$ : circuit capacitif ($\varphi < 0$, $u(t)$ en retard sur $i(t)$).
- **Résonance d'intensité** :
  - Condition : $L\omega_0 - \frac{1}{C\omega_0} = 0 \iff \omega_0 = \frac{1}{\sqrt{LC}} \iff N_0 = \frac{1}{2\pi\sqrt{LC}}$.
  - À la résonance : $Z_{min} = R_t$, l'intensité est maximale $I_0 = \frac{U}{R_t}$ et $\varphi = 0$ (tension et courant en phase).
- **Facteur de qualité $Q$** :
  $$Q = \frac{L\omega_0}{R_t} = \frac{1}{R_t C \omega_0} = \frac{1}{R_t}\sqrt{\frac{L}{C}}$$
- **Bande passante à $-3\text{ dB}$** :
  - Définie par $I \ge \frac{I_0}{\sqrt{2}}$ entre les pulsations de coupure $\omega_1$ et $\omega_2$.
  - Largeur de bande : $\Delta\omega = \omega_2 - \omega_1 = \frac{\omega_0}{Q} = \frac{R_t}{L}$.
  - En fréquence : $\Delta N = \frac{N_0}{Q} = \frac{R_t}{2\pi L}$.
  - Plus la résistance $R_t$ est faible, plus $Q$ est élevé et la résonance est aiguë.
- **Phénomène de surtension** :
  - À la résonance, la tension efficace aux bornes du condensateur vaut : $U_{C,0} = \frac{I_0}{C\omega_0} = Q \cdot U$.
  - Si $Q > 1$, il y a surtension ($U_C > U$).
- **EXCLUSION SM** : La modulation d'amplitude AM N'EST PAS au programme de Sciences Mathématiques.

---

## 4. Mécanique Générale et Spécifique SM
### A. Lois de Newton et Mouvement du centre d'inertie
- Référentiels galiléens (terrestre, géocentrique, héliocentrique).
- 2ème loi de Newton : $\sum \vec{F}_{ext} = m \vec{a}_G$.
- Démarche impérative du barème : 1) Système étudié, 2) Référentiel galiléen, 3) Bilan complet des forces.
- Chute verticale dans un fluide : $m \frac{dv}{dt} = P - F_A - f(v) \implies \frac{dv}{dt} + \frac{k}{m} v^n = g\left(1 - \frac{\rho_f}{\rho_s}\right)$.
- Mouvement des projectiles : équations horaires et équation de la trajectoire parabolique.
- Particules chargées : dans un champ électrostatique uniforme $\vec{E}$ ($\vec{a} = \frac{q}{m}\vec{E}$) et champ magnétique uniforme $\vec{B}$ (force de Lorentz $\vec{F} = q\vec{v}\wedge\vec{B}$, trajectoire circulaire uniforme de rayon $R = \frac{m v}{|q| B}$).
- Satellites et planètes : 3 lois de Kepler, vitesse orbitale $v = \sqrt{\frac{G M}{r}}$, 3ème loi $\frac{T^2}{r^3} = \frac{4\pi^2}{G M}$.

### B. SPÉCIFIQUE SCIENCES MATHÉMATIQUES : Rotation d'un solide autour d'un axe fixe
- **Relation Fondamentale de la Dynamique en rotation (RFD)** :
  $$\sum M_\Delta(\vec{F}_{ext}) = J_\Delta \cdot \ddot{\theta}$$
  où $J_\Delta$ est le moment d'inertie du solide par rapport à l'axe $\Delta$ (en $\text{kg}\cdot\text{m}^2$) et $\ddot{\theta} = \frac{d^2\theta}{dt^2}$ est l'accélération angulaire (en $\text{rad}\cdot\text{s}^{-2}$).
- **Moment d'une force** : $M_\Delta(\vec{F}) = \pm F \cdot d$ où $d$ est la distance orthogonale entre la ligne d'action de $\vec{F}$ et l'axe $\Delta$.
- **Énergie cinétique de rotation** :
  $$E_c = \frac{1}{2} J_\Delta \dot{\theta}^2$$
- **Théorème de l'énergie cinétique en rotation** :
  $$\Delta E_c = \sum W_\Delta(\vec{F}_{ext}) = \sum \int M_\Delta(\vec{F}) d\theta$$
- **Condition de non-glissement fil-poulie (ou roue sans glissement)** :
  - Distance parcourue : $s = R \theta$.
  - Vitesse linéaire : $v = R \dot{\theta} = R \omega$.
  - Accélération tangentielle : $a = R \ddot{\theta}$.
  - Relation vectorielle des tensions si le fil a une masse négligeable et ne glisse pas sur la poulie de moment d'inertie $J_\Delta$.

### C. Systèmes Oscillants Mécaniques (Pendules)
- **Pendule élastique** : Équation différentielle $\ddot{x} + \frac{k}{m} x = 0 \implies T_0 = 2\pi\sqrt{\frac{m}{k}}$, énergie mécanique $E_m = \frac{1}{2}m\dot{x}^2 + \frac{1}{2}kx^2 = \text{cte}$.
- **Pendule de torsion (Spécifique SM)** :
  - Moment du couple de torsion : $M_c = -C \theta$ ($C$ en $\text{N}\cdot\text{m}\cdot\text{rad}^{-1}$).
  - Équation différentielle : $J_\Delta \ddot{\theta} + C \theta = 0 \implies T_0 = 2\pi\sqrt{\frac{J_\Delta}{C}}$.
  - Énergie potentielle de torsion : $E_{pt} = \frac{1}{2} C \theta^2$.
- **Pendule pesant et pendule simple** :
  - Équation différentielle aux faibles oscillations : $\ddot{\theta} + \frac{m g d}{J_\Delta} \theta = 0 \implies T_0 = 2\pi\sqrt{\frac{J_\Delta}{m g d}}$. Pour le pendule simple ($J_\Delta = m \ell^2$) : $T_0 = 2\pi\sqrt{\frac{\ell}{g}}$.
- **Oscillations mécaniques forcées et résonance (Spécifique SM)** :
  - Excitateur imposant une fréquence $N$, résonateur répondant avec amplitude maximale pour $N \approx N_0$.
  - Influence de l'amortissement sur l'acuité de la résonance mécanique et décalage de la fréquence de résonance.

---

## 5. Chimie pour Sciences Mathématiques
- **Cinétique chimique** : vitesse volumique $v(t) = \frac{1}{V}\frac{dx}{dt}$, temps de demi-réaction $t_{1/2}$, facteurs cinétiques (température, concentrations).
- **Équilibre chimique** : quotient de réaction $Q_r$, constante d'équilibre $K$, taux d'avancement final $\tau = \frac{x_f}{x_{max}}$ ($\tau < 1 \iff$ transformation limitée).
- **Acido-basicité** : produit ionique de l'eau $K_e$, constante d'acidité $K_A$, relation Henderson $pH = pK_A + \log\frac{[A^-]}{[AH]}$, titrage pH-métrique et conductimétrique (relation à l'équivalence $C_A V_A = C_B V_{BE}$).
- **Piles électrochimiques** : critère d'évolution spontanée ($Q_{r,i} < K \implies$ sens direct), polarité des électrodes (anode = oxydation, cathode = réduction), quantité d'électricité débitée $Q = I \Delta t = n(e^-) \cdot \mathcal{F}$ avec $\mathcal{F} \approx 96500\text{ C}\cdot\text{mol}^{-1}$.
- **Électrolyse (transformations forcées)** : principe, réactions aux électrodes, calculs des masses de métal déposé ou volume de gaz dégagé.
- **Chimie organique** : réactions d'estérification et hydrolyse d'ester (lentes, limitées, athermiques), amélioration du rendement (excès de réactif, distillation d'un produit), utilisation des anhydrides d'acide (réaction totale et rapide), saponification (rapide et totale).
