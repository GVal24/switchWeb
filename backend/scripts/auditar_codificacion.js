const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');

const EXTENSIONES = new Set([
  '.js', '.json', '.dart', '.sql', '.md', '.txt', '.yml', '.yaml', '.env', '.html', '.css',
]);

const IGNORAR = new Set([
  'node_modules', '.git', 'build', '.dart_tool', 'uploads', 'coverage', '.idea', '.vscode',
]);

/** Rangos que no deberían aparecer en un proyecto en español. */
const RANGOS_SOSPECHOSOS = [
  [0x0400, 0x04ff, 'cirílico'],
  [0x0590, 0x05ff, 'hebreo'],
  [0x0600, 0x06ff, 'árabe'],
  [0x3040, 0x30ff, 'japonés'],
  [0x4e00, 0x9fff, 'chino'],
  [0xac00, 0xd7af, 'coreano'],
  [0x0e00, 0x0e7f, 'tailandés'],
];

function auditarArchivo(ruta) {
  const problemas = [];
  const buffer = fs.readFileSync(ruta);

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    problemas.push('tiene BOM al principio (UTF-8 con BOM)');
  }

  let texto;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (_) {
    problemas.push('NO es UTF-8 válido');
    return problemas;
  }

  const linhas = texto.split(/\r?\n/);
  linhas.forEach((linea, indice) => {
    for (const [desde, hasta, nombre] of RANGOS_SOSPECHOSOS) {
      for (const caracter of linea) {
        const codigo = caracter.codePointAt(0);
        if (codigo >= desde && codigo <= hasta) {
          problemas.push(
            `línea ${indice + 1}: carácter fuera de lugar (${nombre}) U+` +
              codigo.toString(16).toUpperCase().padStart(4, '0')
          );
          return;
        }
      }
    }
    
    if (linea.includes(String.fromCharCode(0xFFFD))) {
      problemas.push(`línea ${indice + 1}: contiene el carácter de reemplazo U+FFFD`);
    }
  });

  return [...new Set(problemas)];
}

function recorrer(carpeta, accumulator = []) {
  for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const completa = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) {
      recorrer(completa, accumulator);
    } else if (EXTENSIONES.has(path.extname(entrada.name).toLowerCase())) {
      accumulator.push(completa);
    }
  }
  return accumulator;
}

const argumentos = process.argv.slice(2);
const objetivos = argumentos.length
  ? argumentos.map((a) => path.resolve(a))
  : recorrer(RAIZ);

let conProblemas = 0;
for (const ruta of objetivos) {
  const problemas = auditarArchivo(ruta);
  if (problemas.length) {
    conProblemas += 1;
    console.log(`\n${path.relative(RAIZ, ruta)}`);
    problemas.forEach((p) => console.log(`   - ${p}`));
  }
}

console.log(
  `\n${'='.repeat(52)}\nRevisados: ${objetivos.length} archivos. ` +
    `Con problemas: ${conProblemas}.\n${'='.repeat(52)}`
);
process.exit(conProblemas > 0 ? 1 : 0);
