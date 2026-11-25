SKILL PÉDAGOGIQUE : DIPÔLES RC, RL & OSCILLATIONS LIBRES RLC (2BAC PC & SM)
- Méthode canonique exigée par le barème : 1) Préciser le sens arbitraire du courant $i$ et le fléchage en **convention récepteur** ; 2) Énoncer la loi d'additivité des tensions ; 3) Substituer $u_R = R i$, $i = C\frac{du_C}{dt}$ ou $u_b = r i + L\frac{di}{dt}$ ; 4) Isoler l'équation différentielle.
- Dipôle RC : $\tau = R C$. En charge : $u_C(t) = E(1 - e^{-t/\tau})$ ($u_C(\tau) \approx 0.63 E$). En décharge : $u_C(t) = E e^{-t/\tau}$ ($u_C(\tau) \approx 0.37 E$). Tangente à $t=0$ coupe l'asymptote à $t = \tau$.
- Dipôle RL : $\tau = \frac{L}{R_T}$ où $R_T = R + r$ (ne jamais oublier la résistance interne $r$ de la bobine). En régime permanent : $I_0 = \frac{E}{R+r}$.
- Circuit RLC libre : distinguer régime périodique ($R_T = 0$, $T_0 = 2\pi\sqrt{LC}$), pseudo-périodique ($T \approx T_0$, décroissance due à l'effet Joule $dE_T/dt = -R_T i^2 < 0$) et apériodique.
- Piège classique énergie : les énergies $E_e = \frac{1}{2}Cu_C^2$ et $E_m = \frac{1}{2}Li^2$ ont une période $\mathcal{T}_{\text{énergie}} = \frac{T}{2}$ (la moitié de celle de $u_C(t)$).
- Entretien des oscillations : le générateur $u_g = k \cdot i$ compense exactement la résistance totale lorsque $k = R_T$.

