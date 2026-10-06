#!/bin/bash
# Descarga en TCEE/.fuentes-idiomas/ las fuentes abiertas con las que Claude fabrica el paquete de idiomas (main/IDIOMAS.md, apartado «Fuentes»).
# Se ejecuta en el Mac (sin tarea de VS Code: es auxiliar; ver IDIOMAS.md). El entorno de Claude no llega a estas webs.
# No hace falta volver a ejecutarlo salvo que Claude lo pida. Ocupa unos 300 MB; la carpeta no se sube a GitHub.
BASE="$(cd "$(dirname "$0")/../../.." && pwd)"
D="$BASE/.fuentes-idiomas"
mkdir -p "$D/tatoeba" "$D/cefrlex" "$D/tex" "$D/pdf"
bajar() {  # bajar URL FICHERO  (no vuelve a bajar lo que ya está)
  [ -s "$2" ] && { echo "  ya estaba: $(basename "$2")"; return 0; }
  if curl -fsSL --retry 2 -m 900 -o "$2.tmp" "$1"; then mv "$2.tmp" "$2"; echo "  ok: $(basename "$2")"; return 0; fi
  rm -f "$2.tmp"; echo "  NO: $1"; return 1
}

echo "1/4 Tatoeba (frases con traducción; CC BY 2.0 FR)"
T=https://downloads.tatoeba.org/exports
for l in fra eng spa; do bajar "$T/per_language/$l/${l}_sentences.tsv.bz2" "$D/tatoeba/${l}_sentences.tsv.bz2"; done
for p in fra-spa eng-spa fra-eng; do bajar "$T/per_language/${p%-*}/${p}_links.tsv.bz2" "$D/tatoeba/${p}_links.tsv.bz2" || NOLINKS=1; done
[ -n "$NOLINKS" ] && bajar "$T/links.tar.bz2" "$D/tatoeba/links.tar.bz2"
bajar "$T/sentences_with_audio.tar.bz2" "$D/tatoeba/sentences_with_audio.tar.bz2"
bajar "$T/tags.tar.bz2" "$D/tatoeba/tags.tar.bz2"

echo "2/4 EFLLex y FLELex (nivel del Marco Europeo de cada palabra; CC BY-NC-SA 4.0)"
C=https://cental.uclouvain.be/cefrlex/static/resources
bajar "$C/en/EFLLex.tsv" "$D/cefrlex/EFLLex.tsv"
for f in FLELex_TreeTagger.tsv FLELex_CRF_Tagger.tsv FLELex.tsv FLELex_TreeTagger_Beacco.tsv; do bajar "$C/fr/$f" "$D/cefrlex/$f" && break; done

echo "3/4 Tex's French Grammar (Universidad de Texas; CC BY 3.0)"
X=https://laits.utexas.edu/tex/gr
for p in no1 no2 no3 no4 no5 det1 det2 det3 det4 det5 det6 det7 det8 det9 det10 adv1 adv2 adv3 adv4 adv5 adv6 adj1 adj2 adj3 adj4 adj5 adj6 adj7 adj8 adj9 \
  v1 ver1 ver2 vir1 vir2 vir3 vre1 vre2 vre3 vre4 virr1 virr2 virr3 virr4 virr5 virr6 virr7 virr8 virr9 virr10 virr11 vpr1 vm1 vim1 vl1 vinf1 vti1 vpp1 \
  neg1 neg2 neg3 neg4 neg5 pre1 pre1a pre2 pred1 pred2 prep1 pre3 pre4 pro1 pro2 pro3 pro4 pro5 pro6 pro7 pro8 pro9 pro10 pro11 pro12 pror1 pror2 pror3 \
  con1 con2 con3 ta1 tapr1 tap1 tap2 tap3 tap4 tap5 tap6 tap7 tap8 tap9 tap10 tap11 taf1 taf2 taf3 taf4 taf5 tai1 tas1 tas2 tas3a tas3b tas4 tas5 tas6 tas7 tas8 \
  tac1 tac2 tac3 tad1 tad2 tav1 int1 int2 int3 int4 int5 int6 int7 overview credits index; do
  bajar "$X/$p.html" "$D/tex/$p.html" >/dev/null || echo "  NO: $p"
done
echo "  páginas: $(ls "$D/tex" | wc -l | tr -d ' ')"
bajar "https://www.laits.utexas.edu/fi/tv/" "$D/tex/testez-vous.html"
bajar "https://www.laits.utexas.edu/fi/vp/" "$D/tex/verb-practice.html"

echo "4/4 Inventarios del Marco Europeo (índice de materias)"
bajar "https://www.eaquals.org/wp-content/uploads/EAQUALS_British_Council_Core_Curriculum_April2011.pdf" "$D/pdf/core_inventory_english.pdf"
bajar "https://interlangues.dis.ac-guyane.fr/IMG/article_PDF/Inventaire-linguistique-des-contenus-cles-des-niveaux-du_a160.pdf" "$D/pdf/inventaire_francais.pdf"

echo ""
echo "Hecho. Tamaño total: $(du -sh "$D" | cut -f1). Avisa a Claude: ya puede fabricar el paquete."
