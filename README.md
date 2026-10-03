# main — entorno de trabajo de la oposición TCEE

Repositorio para todo lo que no es un tema: la configuración del editor, los scripts de sincronización y los análisis del temario.

| Qué | Dónde |
|---|---|
| Cómo instalar y usar el entorno (empieza aquí) | [GUIA_INSTALACION.md](GUIA_INSTALACION.md) |
| Espacio de trabajo de VS Code | `TCEE.code-workspace` |
| Descargar el temario | `scripts/descargar_temario.sh` |
| Sincronizar todo con GitHub | `scripts/sincronizar_todo.sh` |
| Compilar un tema / todos (PDF también a iCloud) | `scripts/compilar.sh` · `scripts/compilar_todo.sh` |
| Atajos de escritura (`eqb`, `img`, `rec`…) | `config/tcee.code-snippets` |
| Lista de temas (rutas) | `config/temas.txt` |
| Historial de cambios: cómo verlo y deshacer | [HISTORIAL.md](HISTORIAL.md) |
| Estado de compilación de cada tema | [ESTADO_COMPILACION.md](ESTADO_COMPILACION.md) |
| Modelos mencionados en cada tema | `analisis/Modelos_temario_TCEE.xlsx` |
| Modelos desarrollados matemáticamente y duplicidades | `analisis/Desarrollos_modelos_TCEE.xlsx` y `analisis/desarrollos.json` |
| Instrucciones para Claude | `CLAUDE.md` |

Estructura en tu Mac:

```
TCEE/
├── main/              ← este repositorio (herramientas)
└── temario/           ← todos los temas (repositorio OposicionTCEE/temario)
    ├── Ejercicio-3/
    │   ├── Parte-A/   3.A.1 … 3.A.45
    │   └── Parte-B/   3.B.1 … 3.B.45
    └── Ejercicio-4/
        └── Parte-B/   4.B.3 … 4.B.26
```

> Este repositorio es público. No guardes aquí nada personal ni privado.
