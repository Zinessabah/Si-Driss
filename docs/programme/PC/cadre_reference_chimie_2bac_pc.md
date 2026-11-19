# Cadre de Référence Officiel - Chimie (2ème Bac Sciences Physiques BIOF Maroc)

Document de cadrage officiel du Ministère de l'Éducation Nationale pour l'Examen National du Baccalauréat (Filière Sciences Physiques - BIOF).

---

## 1. Transformations Lentes et Rapides & Suivi Temporel de la Cinétique Chimique

### A. Notions fondamentales & Facteurs cinétiques
- **Transformation rapide** : Évolution quasi-instantanée, impossible à suivre à l'œil nu ou avec les instruments usuels de mesure (ex: précipitations, réactions acide-base usuelles).
- **Transformation lente** : Évolution durant quelques secondes à plusieurs heures, mesurable expérimentalement.
- **Couples oxydant / réducteur ($\text{Ox}/\text{Red}$)** : Écriture équilibrée des demi-équations électroniques et de l'équation bilan d'oxydoréduction.
- **Facteurs cinétiques officiels** :
  - **Température** : L'augmentation de la température accélère le mouvement brownien et le nombre de chocs efficaces $\implies$ la vitesse de réaction augmente.
  - **Concentration initiale des réactifs** : Plus les concentrations sont élevées, plus la probabilité de chocs efficaces entre réactifs est grande $\implies$ la réaction est plus rapide.
  - **Catalyseur** : Espèce chimique accélérant la transformation sans figurer dans l'équation bilan et retrouvée intacte à la fin.

### B. Vitesse volumique de réaction & Temps de demi-réaction
- **Tableau d'avancement complet** : États initial ($t=0$), intermédiaire ($t$) et final ($t_f$ ou $t_\infty$) exprimés rigoureusement en moles ($\text{mol}$).
- **Vitesse volumique de réaction** :
  $$v(t) = \frac{1}{V_S} \frac{dx}{dt}$$
  - $V_S$ : Volume total du mélange réactionnel en litres ($\text{L}$) ou $\text{m}^3$.
  - $v(t)$ s'exprime en $\text{mol}\cdot\text{L}^{-1}\cdot\text{s}^{-1}$ (ou $\text{mol}\cdot\text{L}^{-1}\cdot\text{min}^{-1}$).
  - Détermination graphique : $\frac{dx}{dt} = \frac{\Delta x}{\Delta t}$ est le coefficient directeur de la tangente à la courbe $x(t)$ à l'instant considéré.
  - Évolution temporelle : La vitesse volumique diminue au cours du temps car les concentrations des réactifs diminuent (diminution de la fréquence des chocs efficaces).
- **Temps de demi-réaction $t_{1/2}$** :
  - Durée au bout de laquelle l'avancement atteint la moitié de sa valeur finale :
    $$x(t_{1/2}) = \frac{x_f}{2} \quad \left(\text{ou } x(t_{1/2}) = \frac{x_{max}}{2} \text{ si la réaction est totale}\right)$$
  - Détermination graphique directe sur la courbe $x(t)$ ou indirecte sur les grandeurs mesurées proportionnelles.

### C. Les 5 Méthodes Officielles de Suivi Temporel au Baccalauréat Marocain
1. **Mesure de pression d'un gaz produit ($P$)** :
   - Application de l'équation des gaz parfaits : $P \cdot V = n_{\text{gaz}} \cdot R \cdot T$.
   - Relation avec l'avancement : $\Delta P(t) = P(t) - P_0 = \frac{n_{\text{gaz}}(t) R T}{V_{\text{flacon}}}$.
   - Formule d'avancement : $x(t) = \frac{\Delta P(t)}{\Delta P_{max}} \cdot x_{max}$.
   - *Unités SI obligatoires* : $P$ en Pascal ($\text{Pa}$, avec $1\text{ bar} = 10^5\text{ Pa}$, $1\text{ hPa} = 100\text{ Pa}$), $V$ en $\text{m}^3$ ($1\text{ L} = 10^{-3}\text{ m}^3$), $T$ en Kelvin ($T(\text{K}) = \theta(^\circ\text{C}) + 273.15$).
2. **Mesure du volume d'un gaz dégagé ($V_{\text{gaz}}$)** :
   - Relation : $V_{\text{gaz}}(t) = n_{\text{gaz}}(t) \cdot V_m \implies x(t) = \frac{V_{\text{gaz}}(t)}{V_m}$.
   - $V_m$ est le volume molaire des gaz dans les conditions de l'expérience ($\text{L}\cdot\text{mol}^{-1}$).
3. **Conductimétrie (Loi de Kohlrausch)** :
   - Relation : $\sigma(t) = \sum \lambda_i [X_i](t)$.
   - *PIÈGE DU NATIONAL* : Dans la loi de Kohlrausch, les concentrations $[X_i]$ doivent impérativement être exprimées en $\mathbf{mol\cdot m^{-3}}$ ($1\text{ mol/L} = 1000\text{ mol/m}^3$) !
   - Relation linéaire : $\sigma(t) = A + B \cdot x(t) \implies x(t) = \frac{\sigma(t) - \sigma_0}{\sigma_f - \sigma_0} \cdot x_f$.
4. **pH-métrie** :
   - Pour les transformations consommant ou produisant des ions oxonium : $[H_3O^+](t) = 10^{-pH(t)}$.
5. **Dosage volumétrique (Titrage)** :
   - Technique avec **trempe thermique** : ajout rapide d'eau glacée (ou immersion dans la glace) pour figer brutalement la réaction à la date $t$ par abaissement de température.
   - Titrage acido-basique ou d'oxydoréduction des prélèvements à l'aide d'une solution titrante de concentration connue.
- ⚠️ *Note officielle de conformité* : La spectrophotométrie et la loi de Beer-Lambert ($A = \epsilon \cdot \ell \cdot C$) **NE font PAS partie** du cadre de référence marocain (spécifiques au programme français).

---

## 2. Transformations Non Totales & Équilibre Chimique

### A. Taux d'avancement final & Équilibre dynamique
- **Taux d'avancement final** :
  $$\tau = \frac{x_f}{x_{max}}$$
  - Si $\tau = 1$ (ou $100\%$) : transformation **totale**.
  - Si $\tau < 1$ (ou $< 100\%$) : transformation **non totale / limitée**, aboutissant à un état d'équilibre chimique.
  - Dépendance : $\tau$ dépend de la constante d'équilibre $K$ et de la concentration initiale $C$ (la dilution augmente $\tau$).

### B. Quotient de réaction $Q_r$ et Constante d'équilibre $K$
- Pour une équation bilan : $a A_{(aq)} + b B_{(aq)} \rightleftharpoons c C_{(aq)} + d D_{(aq)}$ :
  $$Q_r = \frac{[C]^c [D]^d}{[A]^a [B]^b}$$
  - **Règle impérative** : Seules les espèces solutées dissoutes figurent dans $Q_r$. L'eau solvant ($H_2O$) et les solides ont par convention une activité unitaire ($1$).
- **Constante d'équilibre $K$** :
  - Valeur du quotient de réaction à l'état d'équilibre : $K = Q_{r,eq}$.
  - $K$ est une constante thermodynamique qui **ne dépend QUE de la température** (indépendante des concentrations initiales).

---

## 3. Transformations Acido-Basiques en Solution Aqueuse

### A. Définitions & Constantes caractéristiques
- **Autoprotolyse de l'eau & Produit ionique** :
  $$2 H_2O_{(l)} \rightleftharpoons H_3O^+_{(aq)} + HO^-_{(aq)} \implies K_e = [H_3O^+]_{eq}[HO^-]_{eq} = 10^{-14} \quad (\text{à } 25^\circ\text{C})$$
  $$pK_e = -\log K_e = 14$$
- **Constante d'acidité $K_A$ et $pK_A$ d'un couple $AH / A^-$** :
  $$AH_{(aq)} + H_2O_{(l)} \rightleftharpoons A^-_{(aq)} + H_3O^+_{(aq)} \implies K_A = \frac{[A^-]_{eq}[H_3O^+]_{eq}}{[AH]_{eq}}$$
  $$pK_A = -\log K_A \iff K_A = 10^{-pK_A}$$
- **Relation d'Henderson-Hasselbalch** :
  $$pH = pK_A + \log\left(\frac{[A^-]_{eq}}{[AH]_{eq}}\right)$$

### B. Diagrammes de prédominance et de distribution
- Si $pH < pK_A$ : $[AH]_{eq} > [A^-]_{eq} \implies$ la forme acide **$AH$ prédomine**.
- Si $pH = pK_A$ : $[AH]_{eq} = [A^-]_{eq} \implies$ concentrations égales.
- Si $pH > pK_A$ : $[A^-]_{eq} > [AH]_{eq} \implies$ la forme basique **$A^-$ prédomine**.

### C. Titrage acido-basique (pH-métrique et indicateurs colorés)
- **Définition de l'équivalence** : Les réactifs titré et titrant sont mélangés en proportions stœchiométriques.
- **Relation à l'équivalence** :
  $$C_A \cdot V_A = C_B \cdot V_{bE} \quad (\text{ou } C_B \cdot V_B = C_A \cdot V_{aE})$$
- **Détermination du point équivalent $E(V_{bE}, pH_E)$** :
  1. Méthode des tangentes parallèles.
  2. Méthode de la dérivée $\frac{dpH}{dV_b}$ (pic d'extrémum).
- **Choix de l'indicateur coloré convenable** :
  - La zone de virage de l'indicateur doit obligatoirement englober le $pH_E$ du point d'équivalence.
- **Propriété de la demi-équivalence ($V_b = V_{bE}/2$)** :
  - $[AH] = [A^-] \implies pH = pK_A$ (solution tampon : faible sensibilité du pH aux ajouts et à la dilution).

---

## 4. Sens d'Évolution Spontanée & Piles Électrochimiques

### A. Critère d'évolution spontanée
- On calcule le quotient de réaction initial $Q_{r,i}$ :
  - **Si $Q_{r,i} < K$** : Le système évolue spontanément dans le **sens direct (1)**.
  - **Si $Q_{r,i} > K$** : Le système évolue spontanément dans le **sens inverse (2)**.
  - **Si $Q_{r,i} = K$** : Le système est en équilibre dynamique.

### B. Fonctionnement des piles électrochimiques
- **Constitution** : Deux demi-piles métalliques reliées par un pont salin (fermeture du circuit et électroneutralité des solutions) et circuit extérieur (résistance, ampèremètre).
- **Règle mnémotechnique officielle** :
  - **Anode** = **Oxydation** (voyelle/voyelle) $\implies$ pôle **négatif ($\ominus$)** de la pile.
  - **Cathode** = **Réduction** (consonne/consonne) $\implies$ pôle **positif ($\oplus$)** de la pile.
- **Quantité d'électricité débitée pendant une durée $\Delta t$** :
  $$Q = I \cdot \Delta t = n(e^-) \cdot \mathcal{F}$$
  - $I$ en ampères ($\text{A}$), $\Delta t$ obligatoirement en secondes ($\text{s}$).
  - $\mathcal{F} \approx 96500\text{ C}\cdot\text{mol}^{-1}$ (constante de Faraday).
  - Relation avec l'avancement : $n(e^-) = z \cdot x$ ($z$ est le nombre d'électrons échangés par mole).
- **Capacité maximale $Q_{max}$ et durée de vie $\Delta t_{max}$** : Calculées à partir de l'épuisement du réactif limitant ($x_{max}$).

---

## 5. Transformations Forcées : Électrolyse

- **Principe** : En imposant une tension continue supérieure à la f.é.m. de la pile, le générateur force le système à évoluer dans le sens inverse du sens spontané ($Q_{r,i} > K$).
- **Polarité imposée par le générateur** :
  - L'électrode reliée au pôle $(+)$ du générateur subit une **oxydation** $\implies$ **Anode**.
  - L'électrode reliée au pôle $(-)$ du générateur subit une **réduction** $\implies$ **Cathode**.
- **Quantités de matière produites** :
  - Masse de métal déposé : $m = \frac{I \cdot \Delta t}{z \cdot \mathcal{F}} \cdot M$.
  - Volume de gaz dégagé : $V_{\text{gaz}} = \frac{I \cdot \Delta t}{z \cdot \mathcal{F}} \cdot V_m$.

---

## 6. Chimie Organique : Contrôle de l'Évolution des Systèmes

### A. Réactions d'estérification et d'hydrolyse
- **Estérification** : $\text{Acide carboxylique} + \text{Alcool} \rightleftharpoons \text{Ester} + \text{Eau}$.
  - Caractéristiques : **Lente**, **Athermique** ($\Delta H = 0$, la température ne modifie pas $K$), et **Limitée**.
  - **Piège majeur du National** : L'eau n'est PAS le solvant ! Elle intervient au numérateur de la constante d'équilibre :
    $$K = \frac{[\text{ester}]_{eq}[\text{eau}]_{eq}}{[\text{acide}]_{eq}[\text{alcool}]_{eq}} = \frac{x_f^2}{(n_0 - x_f)^2}$$
  - Rendement pour un mélange équimolaire initial :
    - Alcool primaire ($I^\circ$) $\implies r \approx 67\%$ ($K = 4$).
    - Alcool secondaire ($II^\circ$) $\implies r \approx 60\%$ ($K \approx 2.25$).
    - Alcool tertiaire ($III^\circ$) $\implies r \approx 5\%$.
- **Hydrolyse d'un ester** : Réaction inverse de l'estérification, lente, athermique et limitée.

### B. Optimisation du procédé : Cinétique vs Rendement
- **Pour augmenter la vitesse sans changer le rendement** :
  1. Chauffer le mélange réactionnel (chauffage à reflux pour condenser les vapeurs).
  2. Ajouter un catalyseur acide (quelques gouttes de $H_2SO_4$ concentré).
- **Pour augmenter le rendement ($r = x_f / x_{max}$)** :
  1. Utiliser l'un des réactifs en excès.
  2. Éliminer l'eau (par un appareil de Dean-Stark) ou l'ester au fur et à mesure de sa formation.
  3. Utiliser un **anhydride d'acide** au lieu de l'acide carboxylique :
     $$(R-CO)_2O + R'-OH \longrightarrow R-COO-R' + R-COOH$$
     Réaction **rapide**, **totale** ($r = 100\%$) et **irréversible**.

### C. Réaction de saponification (Hydrolyse basique des esters)
- Équation bilan :
  $$R-COO-R' + HO^- \longrightarrow R-COO^- + R'-OH$$
- Caractéristiques : Réaction **lente à froid**, mais **TOTALE** et **irréversible**.
- Produit : Ion carboxylate (savon) + alcool.
