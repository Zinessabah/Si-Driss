SKILL PÉDAGOGIQUE : MODULATION ET DÉMODULATION D'AMPLITUDE AM (2BAC PC & SM)
- Signal modulé : $u_s(t) = k \cdot U_0 (1 + m\cos(2\pi f_s t))\cos(2\pi F_p t)$ avec $m = \frac{U_m}{U_0}$ le taux de modulation et $U_{\max} = A(1+m)$, $U_{\min} = A(1-m)$.
- Taux de modulation : $m = \frac{U_{\max} - U_{\min}}{U_{\max} + U_{\min}}$. Condition de bonne modulation sans surmodulation : $m < 1$ (et $F_p \gg f_s$).
- Méthode du trapèze sur oscilloscope (mode XY) : permet de mesurer $U_{\max}$ et $U_{\min}$ pour calculer $m$.
- Démodulation d'amplitude (3 étages) : 1) Diode (redressement simple alternance) ; 2) Filtre passe-bas RC détecteur d'enveloppe avec la double condition $T_p \ll \tau = RC < T_s$ (justifier physiquement les deux limites : si $\tau \le T_p$, la porteuse HF passe ; si $\tau \ge T_s$, la décharge est trop lente) ; 3) Filtre passe-haut CR de liaison pour éliminer la composante continue $U_0$.

