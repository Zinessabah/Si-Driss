# Cadre de Référence Officiel - Physique (2ème Bac PC BIOF Maroc)

## 1. Ondes Mécaniques & Lumineuses
- **Onde mécanique progressive** : Phénomène de propagation d'une perturbation dans un milieu matériel élastique, sans transport de matière mais avec transport d'énergie.
- **Onde transversale** : La direction de la perturbation est perpendiculaire à la direction de propagation (ex: corde, surface de l'eau).
- **Onde longitudinale** : La direction de la perturbation est parallèle à la direction de propagation (ex: onde sonore, ressort).
- **Retard temporel $\tau$** : $\tau = \frac{SM}{v}$ avec $y_M(t) = y_S(t - \tau)$.
- **Double périodicité** : Spatiale ($\lambda = v \cdot T = \frac{v}{N}$) et temporelle ($T = \frac{1}{N}$).
- **Milieu dispersif** : Milieu dans lequel la célérité $v$ de l'onde dépend de sa fréquence $N$.
- **Diffraction lumineuse** : Écart angulaire $\theta = \frac{\lambda}{a}$. Pour une fente de largeur $a$, avec un écran à distance $D$ et une tache centrale de largeur $L$ : $\tan \theta \approx \theta = \frac{L}{2D} \implies L = \frac{2\lambda D}{a}$.

## 2. Transformations Nucléaires
- **Lois de conservation de Soddy** : Conservation du nombre total de nucléons $A$ et de la charge globale $Z$.
- **Loi de décroissance radioactive** : $N(t) = N_0 \cdot e^{-\lambda t}$ et $a(t) = \lambda N(t) = a_0 \cdot e^{-\lambda t}$.
- **Temps de demi-vie $t_{1/2}$** : Durée nécessaire pour que la moitié des noyaux radioactifs initialement présents se désintègre : $t_{1/2} = \frac{\ln 2}{\lambda}$.
- **Énergie de liaison d'un noyau** : $E_l = \Delta m \cdot c^2 = \left[Z m_p + (A-Z) m_n - m(X)\right] c^2 > 0$.
- **Énergie libérée lors d'une réaction** : $E_{lib} = |\Delta E| = \left| \left(\sum m_{produits} - \sum m_{reactifs}\right) c^2 \right|$.

## 3. Électricité (RC, RL, RLC, Modulation AM)
- **Dipôle RC** : $q = C u_C$, $i = \frac{dq}{dt} = C \frac{du_C}{dt}$. Équation de charge : $u_C + RC \frac{du_C}{dt} = E$ avec $\tau = RC$. À $t = \tau$, $u_C = 0.63 E$.
- **Dipôle RL** : $u_L = L \frac{di}{dt} + r i$. Équation d'établissement : $i + \tau \frac{di}{dt} = \frac{E}{R+r}$ avec $\tau = \frac{L}{R+r}$.
- **Circuit RLC libre** : Équation diff : $\frac{d^2u_C}{dt^2} + \frac{R_T}{L} \frac{du_C}{dt} + \frac{1}{LC} u_C = 0$. Période propre : $T_0 = 2\pi\sqrt{LC}$.
- **Énergie du circuit RLC** : $\mathcal{E}_T = \frac{1}{2} C u_C^2 + \frac{1}{2} L i^2$. ATTENTION : Période des courbes d'énergie $\mathcal{T} = \frac{T}{2}$.
- **Modulation d'amplitude AM** : Taux $m = \frac{S_m}{U_0} = \frac{U_{max}-U_{min}}{U_{max}+U_{min}}$. Condition de bonne modulation : $m < 1$ et $F_p \ge 10 f_s$. Détecteur d'enveloppe : $T_p \ll RC < T_s$.

## 4. Mécanique
- **2ème loi de Newton** : $\sum \vec{F}_{ext} = m \cdot \vec{a}_G$ dans un référentiel galiléen.
- **Rédaction obligatoire** : 1) Système étudié, 2) Référentiel galiléen, 3) Bilan des forces.
- **Chute avec frottement visqueux** : $\frac{dv}{dt} + \frac{1}{\tau} v = A$. Vitesse limite : $v_{lim} = A \cdot \tau$.
- **Méthode d'Euler** : $a_i = A - B v_i$ et $v_{i+1} = v_i + a_i \cdot \Delta t$.
- **Projectile dans $\vec{g}$** : Trajectoire $y(x) = -\frac{g}{2 v_0^2 \cos^2\alpha} x^2 + (\tan\alpha) x + y_0$.
- **Pendule élastique** : $\ddot{x} + \frac{k}{m} x = 0 \implies T_0 = 2\pi\sqrt{\frac{m}{k}}$.
- **Modèle de Bohr** : $E_n = -\frac{13.6}{n^2}\text{ eV}$, $\Delta E = h \nu = \frac{hc}{\lambda}$ avec $1\text{ eV} = 1.602\times 10^{-19}\text{ J}$.
