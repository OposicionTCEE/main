#!/usr/bin/env python3
"""Frases reales de Tatoeba (CC BY 2.0 FR) candidatas para los ejercicios de cada materia de gramática francesa.
Entrada: pares.tsv (lengua, id, frase, traducción al español; ver descargar_fuentes.sh). Salida: <destino>/fr/<idcorto>.tsv (hasta 40 por materia).
Los patrones son aproximados: quien escribe la ficha elige las frases que de verdad sirven."""
import re, sys, os, random
P = {
 'genero-numero': r"\b(les|des) \w+(aux|eux)\b", 'articulos': r"^(Le|La|Les|Un|Une) \w+", 'partitivos': r"\b(du|de la|de l') (pain|vin|lait|café|thé|eau|viande|fromage|argent|temps|chance|sucre)\b",
 'contracciones': r"\b(au|aux|du) \w+", 'posesivos': r"\b(mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs) \w+", 'demostrativos': r"\b(cet|cette|ces) \w+",
 'pronombres-sujeto': r"^(Je|Tu|Il|Elle|On|Nous|Vous|Ils|Elles) \w+", 'presente-er': r"^(Je|Tu|Il|Elle|Nous|Vous|Ils|Elles) \w+(e|es|ons|ez|ent) ",
 'presente-ir-re': r"\b(finis|finit|finissons|partons|pars|part|prends|prend|prenons|prennent|mets|met|vends|vend|attends|attend)\b",
 'etre-avoir': r"\b(ai|as|a|avons|avez|ont) (faim|soif|raison|tort|peur|besoin|envie|sommeil|chaud|froid|mal)\b", 'aller-faire-venir': r"\b(vais|allons|allez|vont|fais|faisons|faites|font|viens|vient|venons|venez|viennent)\b",
 'ilya-voila': r"\b(il y a|Il y a|voilà|Voilà)\b", 'negacion-basica': r"\bne \w+ pas\b|\bn'\w+ pas\b", 'preguntas': r"^(Est-ce que|Où|Quand|Comment|Pourquoi|Combien|Qui)\b.*\?$",
 'quel': r"\b(Quel|Quelle|Quels|Quelles|quel|quelle|quels|quelles)\b", 'adjetivos': r"\b(belle|nouvelle|vieille|bonne|grosse|longue|blanche|heureuse|gentille)\b",
 'preposiciones-lugar': r"\b(en|au|aux) (France|Espagne|Italie|Allemagne|Japon|Canada|Portugal|États-Unis|Chine|Angleterre)\b|\bchez \w+", 'futur-proche': r"\b(vais|vas|va|allons|allez|vont) \w+(er|ir|re)\b",
 'adjetivos-posicion': r"\b(un|une) (grand|grande|petit|petite|beau|belle|jeune|vieux|vieille|bon|bonne|mauvais|nouveau|nouvelle) \w+", 'passe-recent': r"\b(viens|vient|venons|venez|viennent) d[e']\s?\w+",
 'imperativo': r"^[A-ZÉ]\w+(ez|ons)[ -].*[!.]$", 'pronominales': r"\b(me|te|se|nous|vous) (lève|couche|appelle|réveille|habille|promène|souviens|rappelle|dépêche|lave|trompe)",
 'passe-compose-avoir': r"\b(ai|as|a|avons|avez|ont) (mangé|fini|vu|pris|fait|dit|lu|écrit|bu|eu|été|perdu|acheté|oublié|reçu|compris)\b",
 'passe-compose-etre': r"\b(suis|es|est|sommes|êtes|sont) (allée?s?|venue?s?|partie?s?|sortie?s?|arrivée?s?|née?s?|restée?s?|tombée?s?|entrée?s?|rentrée?s?)\b",
 'imparfait': r"\b(étais|était|avais|avait|faisait|allait|voulait|pouvait|habitait|aimait|jouait)\b", 'complementos-cd-ci': r"\b(je|tu|il|elle|nous|vous|ils|elles) (le|la|les|lui|leur) \w+",
 'pronombres-tonicos': r"\b(avec|pour|chez|sans|à|de) (moi|toi|lui|elle|nous|vous|eux|elles)\b|^(Moi|Toi|Lui), ", 'cest-ilest': r"\b(C'est|c'est|Il est|il est|Elle est|elle est) (un|une|très|le|la)\b",
 'comparativo': r"\b(plus|moins|aussi) \w+ que\b|\b(meilleur|meilleure|mieux) que\b", 'superlativo': r"\b(le|la|les) (plus|moins) \w+\b|\b(le|la) meilleure?\b",
 'adverbios': r"\b\w{4,}ment\b", 'cantidad': r"\b(beaucoup|peu|assez|trop|tant) d[e']\s?\w+", 'modales': r"\b(peux|peut|pouvons|pouvez|peuvent|veux|veut|voulons|voulez|veulent|dois|doit|devons|devez|doivent) \w+(er|ir|re)\b",
 'savoir-connaitre': r"\b(sais|sait|savons|savez|savent|connais|connaît|connaissons|connaissez|connaissent)\b", 'verbos-irregulares': r"\b(bois|boit|buvons|crois|croit|vois|voit|voyons|dis|dit|disons|lis|lit|écris|écrit)\b",
 'quitter-partir': r"\b(quitté|quitter|quitte|partir|part|pars|sortir|sors|sort|laissé|laisser|laisse)\b", 'depuis': r"\b(depuis|pendant) \w+|\bil y a \w+ (ans|jours|mois|heures|minutes)\b",
 'relativos-qui-que': r"\w+ (qui|que) \w+", 'futuro-simple': r"\b(serai|sera|aurai|aura|irai|ira|ferai|fera|viendrai|viendra|pourrai|pourra|devrai|saura|verrai|verra|\w+erai|\w+eras|\w+erons|\w+erez|\w+eront)\b",
 'pc-pronominales': r"\b(me suis|t'es|s'est|nous sommes|vous êtes|se sont) \w+", 'pc-vs-imparfait': r"\b(était|avait|faisait)\b.*\b(a|ai|est|suis) \w+(é|i|u|is|it)\b",
 'y-en': r"\b(j'y|j'en|il y va|on y va|y vais|y aller|en ai|en a|en veux|en parle|y pense)\b", 'orden-pronombres': r"\b(me le|me la|me les|te le|le lui|la lui|les lui|le leur|lui en|m'en|t'en|leur en|-le-moi|-la-moi)\b",
 'negacion-compleja': r"\bne \w+ (personne|rien|jamais|plus|aucun|aucune|guère|que)\b|\bn'\w+ (personne|rien|jamais|plus|aucun|que)\b|\bni\b.*\bni\b",
 'tout': r"\b(tout|toute|tous|toutes) (le|la|les|ce|ces|mes|de)\b", 'indefinidos': r"\b(quelqu'un|quelque chose|chaque|chacun|chacune|plusieurs|certains|certaines|quelques)\b",
 'relativos-ce-qui': r"\bce (qui|que|qu')\b", 'relativos-dont-ou': r"\b(dont|lequel|laquelle|lesquels|auquel|duquel)\b|\w+ où \w+", 'demostrativos-pron': r"\b(celui|celle|ceux|celles)\b",
 'posesivos-pron': r"\b(le mien|la mienne|les miens|les miennes|le tien|la tienne|le sien|la sienne|le nôtre|la nôtre|le vôtre|la vôtre|le leur|la leur|les leurs)\b",
 'interrogativos-pron': r"^(Qui|Que|Qu'|Quoi|Lequel|Laquelle|Lesquels|À quoi|De quoi)\b.*\?$", 'plus-que-parfait': r"\b(avais|avait|avions|aviez|avaient|étais|était|étions|étaient) (déjà )?\w+(é|i|u|is|it|ée|és|ées)\b",
 'condicional': r"\b(voudrais|voudrait|pourrais|pourrait|devrais|devrait|serait|aurait|aimerais|ferais|irais|\w+erais|\w+erait)\b", 'si-hipotesis': r"^Si \w+|\bsi (j'|tu |il |elle |nous |vous |on )\w+",
 'subjuntivo-formacion': r"\bque (je|tu|il|elle|nous|vous|ils|elles|j') (sois|soit|soyez|aie|ait|ayez|fasse|fassiez|puisse|puissiez|aille|ailles|veuille|sache|\w+ions|\w+iez)\b",
 'subjuntivo-usos': r"\b(il faut que|faut qu'|veux que|veut que|voudrais que|doute que|bien que|pour que|content que|peur que|important que|souhaite que)\b",
 'estilo-indirecto': r"\b(dit|demande|explique|répond|pense|crois) (que|qu'|si|s'il)\b", 'infinitivo': r"\b(commence|continue|décide|essaie|oublie|refuse|apprend|réussi|arrêté|cessé) (à|de|d') \w+",
 'impersonales': r"\b(il faut|Il faut|il s'agit|Il s'agit|il est (important|nécessaire|possible|impossible|difficile|facile)|il vaut mieux)\b", 'participio-presente': r"\ben \w+ant\b",
 'transitivos': r"\b(attends|attend|cherche|cherches|regarde|écoute|demande|téléphone|obéis|ressemble|pense à|joue (à|de))\b", 'participio-adjetivo': r"\b(fatigué|fatiguée|fermé|fermée|ouvert|ouverte|cassé|cassée|intéressé|surpris|surprise|déçu|déçue)\b",
 'conjunciones': r"\b(parce que|puisque|lorsque|quand|donc|car|pourtant|cependant)\b", 'estilo-indirecto-pasado': r"\b(a dit|disait|a demandé|a expliqué|avait dit) (que|qu'|si|s'il)\b",
 'conjunciones-subjuntivo': r"\b(bien que|quoique|pour que|afin que|avant que|avant qu'|à moins que|sans que|jusqu'à ce que|pourvu que)\b", 'subjuntivo-pasado': r"\bque (je|tu|il|elle|nous|vous|ils|elles|j') (aie|ait|ayez|aient|sois|soit|soient) \w+(é|i|u|is|it|ée|és)\b",
 'evitar-subjuntivo': r"\b(avant de|afin de|sans|pour) \w+(er|ir|re)\b", 'futur-anterieur': r"\b(aurai|auras|aura|aurons|aurez|auront|serai|sera|serons|seront) (déjà )?\w+(é|i|u|is|it|ée|és)\b",
 'condicional-pasado': r"\b(aurais|aurait|aurions|auriez|auraient|serais|serait|seraient) (dû|pu|voulu|été|eu|\w+é|\w+i|\w+u)\b", 'pasiva': r"\b(est|sont|a été|ont été|était|sera|seront|fut) \w+(é|ée|és|ées|is|ise|it|ite) par\b",
 'faire-causativo': r"\b(fais|fait|faire|faisons|font|ferai|ai fait|a fait) (faire|réparer|construire|venir|entrer|attendre|savoir|nettoyer|couper|visiter)\b",
 'passe-simple': r"\b\w+(âmes|âtes|èrent|irent|urent)\b|\b(fut|eut|fit|vint|prit|mourut|naquit|parla|regarda|entra|dit-il)\b", 'passe-anterieur': r"\b(eut|eurent|fut|furent) \w+(é|i|u|is|it)\b",
}
if __name__ == '__main__':
    pares, destino = sys.argv[1], sys.argv[2]
    fr = [l.rstrip('\n').split('\t') for l in open(pares, encoding='utf-8') if l.startswith('fra\t')]
    os.makedirs(os.path.join(destino, 'fr'), exist_ok=True)
    random.seed(1)
    for k, rx in P.items():
        r = re.compile(rx)
        xs = [x for x in fr if r.search(x[2]) and 4 <= len(x[2].split()) <= 14]
        random.shuffle(xs)
        xs = sorted(xs[:400], key=lambda x: len(x[2]))[:40]
        with open(os.path.join(destino, 'fr', k + '.tsv'), 'w', encoding='utf-8') as f:
            for x in xs: f.write(f'tatoeba:{x[1]}\t{x[2]}\t{x[3]}\n')
        print(k, len(xs))
