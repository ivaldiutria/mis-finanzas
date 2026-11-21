import { jsPDF } from 'jspdf';

type RGB = [number, number, number];

const PAGE_W = 210; // A4 mm
const PAGE_H = 297; // A4 mm
const MARGIN_X = 17;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const TOP_Y = 24;
const BOTTOM_Y = 278;

const C_NAVY: RGB = [11, 25, 44];
const C_TEAL: RGB = [13, 148, 136];
const C_TEAL_LIGHT: RGB = [240, 253, 250];
const C_SLATE_900: RGB = [24, 30, 41];
const C_SLATE_700: RGB = [63, 74, 92];
const C_SLATE_500: RGB = [107, 119, 139];
const C_BG_SUBTLE: RGB = [246, 248, 251];
const C_BORDER: RGB = [219, 226, 235];
const C_CODE_BG: RGB = [19, 27, 41];
const C_CODE_TXT: RGB = [232, 241, 249];
const C_AMBER_BG: RGB = [255, 248, 231];
const C_AMBER_BDR: RGB = [217, 134, 17];
const C_WHITE: RGB = [255, 255, 255];

class GuidePdfWriter {
  doc: jsPDF;
  y: number;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });
    this.doc.setProperties({
      title: 'Mis Finanzas — Guía Técnica del Proyecto y Ejecución Independiente',
      subject: 'Documentación técnica y guía paso a paso para ejecutar fuera de Gemini / AI Studio',
      author: 'Mis Finanzas',
      creator: 'Mis Finanzas PWA',
    });
    this.y = TOP_Y;
  }

  private drawRunningHeader() {
    this.doc.setDrawColor(...C_BORDER);
    this.doc.setLineWidth(0.25);
    this.doc.line(MARGIN_X, 14, PAGE_W - MARGIN_X, 14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...C_TEAL);
    this.doc.text(
      'Mis Finanzas — Guía Técnica del Proyecto y Ejecución Independiente',
      MARGIN_X,
      11.5
    );
  }

  newPage(withHeader = true) {
    this.doc.addPage();
    if (withHeader) {
      this.drawRunningHeader();
      this.y = TOP_Y;
    } else {
      this.y = 20;
    }
  }

  ensureSpace(neededMm: number) {
    if (this.y + neededMm > BOTTOM_Y) {
      this.newPage(true);
    }
  }

  drawHeroBanner() {
    const bannerH = 52;
    this.doc.setFillColor(...C_NAVY);
    this.doc.rect(0, 0, PAGE_W, bannerH, 'F');
    this.doc.setFillColor(...C_TEAL);
    this.doc.rect(0, bannerH - 1.8, PAGE_W, 1.8, 'F');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(115, 230, 214);
    this.doc.text(
      'DOCUMENTACIÓN DEL PROYECTO Y GUÍA DE EJECUCIÓN INDEPENDIENTE',
      MARGIN_X,
      15
    );

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(25);
    this.doc.setTextColor(...C_WHITE);
    this.doc.text('Mis Finanzas', MARGIN_X, 27);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(12);
    this.doc.setTextColor(212, 224, 240);
    this.doc.text(
      'Gestión Financiera Personal Bimoneda (USD / VES / USDT)',
      MARGIN_X,
      35.5
    );

    this.doc.setFontSize(9);
    this.doc.setTextColor(166, 186, 209);
    this.doc.text(
      'Explicación técnica, mapa de módulos y guía paso a paso para ejecutarlo fuera de Gemini / AI Studio',
      MARGIN_X,
      43
    );

    this.y = bannerH + 10;
  }

  addSectionTitle(num: string, title: string) {
    this.ensureSpace(16);
    this.y += 2;
    this.doc.setFillColor(...C_TEAL);
    this.doc.rect(MARGIN_X, this.y - 4.5, 7.5, 5.8, 'F');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...C_WHITE);
    this.doc.text(num, MARGIN_X + 2.6, this.y - 0.3);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(13.5);
    this.doc.setTextColor(...C_NAVY);
    this.doc.text(title, MARGIN_X + 10.5, this.y);

    this.y += 3.2;
    this.doc.setDrawColor(...C_BORDER);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGIN_X, this.y, PAGE_W - MARGIN_X, this.y);
    this.y += 6;
  }

  addSubheading(title: string) {
    this.ensureSpace(10);
    this.y += 1.5;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10.8);
    this.doc.setTextColor(...C_TEAL);
    this.doc.text(title, MARGIN_X, this.y);
    this.y += 5.5;
  }

  addParagraph(text: string, fontSize = 9.6) {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(fontSize);
    this.doc.setTextColor(...C_SLATE_700);
    const lines: string[] = this.doc.splitTextToSize(text, CONTENT_W);
    const lineH = 4.9;
    for (const line of lines) {
      this.ensureSpace(lineH);
      this.doc.text(line, MARGIN_X, this.y);
      this.y += lineH;
    }
    this.y += 2;
  }

  addBullet(prefix: string, body: string, fontSize = 9.3) {
    const indent = 5;
    const lineH = 4.7;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(fontSize);
    const full = prefix ? `${prefix} ${body}` : body;
    const lines: string[] = this.doc.splitTextToSize(full, CONTENT_W - indent);

    this.ensureSpace(lineH * Math.min(2, lines.length));
    lines.forEach((line, idx) => {
      this.ensureSpace(lineH);
      if (idx === 0) {
        this.doc.setFillColor(...C_TEAL);
        this.doc.rect(MARGIN_X + 1.2, this.y - 2.3, 1.6, 1.6, 'F');
        if (prefix && line.startsWith(prefix)) {
          const rest = line.slice(prefix.length);
          this.doc.setFont('helvetica', 'bold');
          this.doc.setTextColor(...C_SLATE_900);
          this.doc.text(prefix, MARGIN_X + indent, this.y);
          const pw = this.doc.getTextWidth(prefix);
          this.doc.setFont('helvetica', 'normal');
          this.doc.setTextColor(...C_SLATE_700);
          this.doc.text(rest, MARGIN_X + indent + pw, this.y);
        } else {
          this.doc.setFont('helvetica', 'normal');
          this.doc.setTextColor(...C_SLATE_700);
          this.doc.text(line, MARGIN_X + indent, this.y);
        }
      } else {
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(...C_SLATE_700);
        this.doc.text(line, MARGIN_X + indent, this.y);
      }
      this.y += lineH;
    });
    this.y += 1.4;
  }

  addCallout(title: string, body: string, kind: 'teal' | 'amber' = 'teal') {
    const bg = kind === 'amber' ? C_AMBER_BG : C_TEAL_LIGHT;
    const bdr = kind === 'amber' ? C_AMBER_BDR : C_TEAL;
    const padX = 4.5;
    const padY = 4;
    const lineH = 4.5;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.1);
    const bodyLines: string[] = [];
    for (const para of body.split('\n')) {
      const wrapped = this.doc.splitTextToSize(para, CONTENT_W - padX * 2 - 2);
      bodyLines.push(...wrapped);
    }

    const boxH = padY * 2 + 5.5 + bodyLines.length * lineH;
    this.ensureSpace(boxH + 3);

    this.doc.setFillColor(...bg);
    this.doc.setDrawColor(...C_BORDER);
    this.doc.setLineWidth(0.25);
    this.doc.rect(MARGIN_X, this.y, CONTENT_W, boxH, 'FD');

    this.doc.setFillColor(...bdr);
    this.doc.rect(MARGIN_X, this.y, 1.5, boxH, 'F');

    let curY = this.y + padY + 3.2;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.8);
    this.doc.setTextColor(...C_NAVY);
    this.doc.text(title, MARGIN_X + padX + 1, curY);
    curY += 5.2;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.1);
    this.doc.setTextColor(...C_SLATE_700);
    for (const ln of bodyLines) {
      this.doc.text(ln, MARGIN_X + padX + 1, curY);
      curY += lineH;
    }

    this.y += boxH + 4.5;
  }

  addCodeBlock(lines: string[], caption?: string) {
    const padX = 4.5;
    const padY = 3.5;
    const lineH = 4.5;
    const captionH = caption ? 5.2 : 0;
    const boxH = padY * 2 + captionH + lines.length * lineH;
    this.ensureSpace(boxH + 3);

    this.doc.setFillColor(...C_CODE_BG);
    this.doc.rect(MARGIN_X, this.y, CONTENT_W, boxH, 'F');

    let curY = this.y + padY + 3;
    if (caption) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8.2);
      this.doc.setTextColor(132, 217, 204);
      this.doc.text(caption, MARGIN_X + padX, curY);
      curY += 5.2;
    }

    this.doc.setFont('courier', 'normal');
    this.doc.setFontSize(8.6);
    this.doc.setTextColor(...C_CODE_TXT);
    for (const cl of lines) {
      this.doc.text(cl, MARGIN_X + padX, curY);
      curY += lineH;
    }

    this.y += boxH + 4.5;
  }

  addTable(headers: string[], rows: string[][], colWidths: number[]) {
    const hdrH = 8;
    const padX = 3;
    const padY = 2.6;
    const lineH = 4.2;

    const drawHeader = () => {
      this.doc.setFillColor(...C_NAVY);
      this.doc.rect(MARGIN_X, this.y, CONTENT_W, hdrH, 'F');
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8.7);
      this.doc.setTextColor(...C_WHITE);
      let cx = MARGIN_X + padX;
      headers.forEach((h, i) => {
        this.doc.text(h, cx, this.y + 5.4);
        cx += colWidths[i];
      });
      this.y += hdrH;
    };

    this.ensureSpace(hdrH + 10);
    drawHeader();

    rows.forEach((row, rIdx) => {
      this.doc.setFontSize(8.5);
      const wrappedCols = row.map((cell, i) => {
        this.doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        return this.doc.splitTextToSize(cell, colWidths[i] - padX * 2) as string[];
      });
      const maxLines = Math.max(...wrappedCols.map((c) => c.length));
      const rh = Math.max(7.5, maxLines * lineH + padY * 2);

      if (this.y + rh > BOTTOM_Y) {
        this.newPage(true);
        drawHeader();
      }

      if (rIdx % 2 === 1) {
        this.doc.setFillColor(...C_BG_SUBTLE);
      } else {
        this.doc.setFillColor(...C_WHITE);
      }
      this.doc.setDrawColor(...C_BORDER);
      this.doc.setLineWidth(0.2);
      this.doc.rect(MARGIN_X, this.y, CONTENT_W, rh, 'FD');

      let cx = MARGIN_X + padX;
      wrappedCols.forEach((lines, cIdx) => {
        let ty = this.y + padY + 3.1;
        this.doc.setFont('helvetica', cIdx === 0 ? 'bold' : 'normal');
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(...(cIdx === 0 ? C_NAVY : C_SLATE_700));
        for (const ln of lines) {
          this.doc.text(ln, cx, ty);
          ty += lineH;
        }
        cx += colWidths[cIdx];
      });

      this.y += rh;
    });

    this.y += 5;
  }

  finalizeFooters() {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      this.doc.setDrawColor(...C_BORDER);
      this.doc.setLineWidth(0.25);
      this.doc.line(MARGIN_X, PAGE_H - 14, PAGE_W - MARGIN_X, PAGE_H - 14);

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8.2);
      this.doc.setTextColor(...C_SLATE_500);
      this.doc.text(
        'Documentación Técnica · Mis Finanzas (PWA Bimoneda USD / VES)',
        MARGIN_X,
        PAGE_H - 9
      );

      this.doc.setFont('helvetica', 'bold');
      const pageLabel = `Página ${i} de ${total}`;
      const pw = this.doc.getTextWidth(pageLabel);
      this.doc.text(pageLabel, PAGE_W - MARGIN_X - pw, PAGE_H - 9);
    }
  }
}

export function createProjectGuidePdf(): jsPDF {
  const pdf = new GuidePdfWriter();

  // PÁGINA 1: PORTADA Y RESUMEN EJECUTIVO
  pdf.drawHeroBanner();

  pdf.addSectionTitle('1', '¿Qué es este proyecto?');
  pdf.addParagraph(
    'Mis Finanzas es una Aplicación Web Progresiva (PWA) de finanzas personales diseñada específicamente para la realidad bimoneda (Dólares USD, Bolívares VES y USDT), con soporte nativo para la tasa oficial del Banco Central de Venezuela (BCV), múltiples billeteras y bancos, financiamiento comercial por cuotas, planificación personal y estadísticas ejecutivas.'
  );

  pdf.addCallout(
    'Dato clave: NO depende de Gemini ni de Google AI Studio para funcionar',
    'Aunque el proyecto fue construido en Google AI Studio e incluye en package.json la dependencia de plantilla @google/genai, la aplicación NO realiza llamadas a modelos de IA ni requiere GEMINI_API_KEY en tiempo de ejecución. Toda la lógica financiera corre 100% en tu navegador y puedes ejecutarla localmente o en cualquier servidor propio.',
    'teal'
  );

  pdf.addSubheading('Ficha técnica rápida');
  pdf.addTable(
    ['Componente', 'Tecnología / Detalle'],
    [
      ['Frontend', 'React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + Lucide Icons + Motion'],
      ['Persistencia de datos', '100% Local en el navegador (localStorage: mis_finanzas_personal_app_v1) + Respaldo JSON'],
      ['API de Tasa Oficial BCV', 'Consulta directa HTTP GET a https://dolarflow.com/api/oficial/ (con modo manual e historial)'],
      ['Servidor de producción', 'Express (server.js / server.ts) para servir la compilación estática dist/ y /health'],
      ['Capacidades PWA', 'vite-plugin-pwa + Service Worker (instalable en móvil/PC con soporte offline)'],
      ['Exportación de datos', 'Respaldos completos .JSON, historial de tasas .XLSX/.JSON (SheetJS) y Reporte PDF Mensual'],
    ],
    [54, CONTENT_W - 54]
  );

  pdf.addSubheading('Principios contables del sistema');
  pdf.addBullet(
    'Aislamiento entre Saldo Real y Proyectado:',
    'Solo los movimientos completados afectan tus billeteras reales. Las transacciones pendientes, suscripciones por vencer y cuotas futuras alimentan el Saldo Proyectado.'
  );
  pdf.addBullet(
    'Precisión bimoneda:',
    'Cada movimiento conserva el monto nominal (Bs o USD), la tasa de cambio aplicada en su fecha y su equivalente exacto en USD.'
  );
  pdf.addBullet(
    'Privacidad total (Local-First):',
    'Tus saldos, cuentas y movimientos nunca se envían a bases de datos externas ni a servicios de IA; permanecen exclusivamente en tu dispositivo.'
  );

  // PÁGINA 2: ARQUITECTURA Y ESTRUCTURA DEL CÓDIGO
  pdf.newPage();
  pdf.addSectionTitle('2', 'Arquitectura y Estructura del Código');
  pdf.addParagraph(
    'El proyecto sigue una arquitectura Single Page Application (SPA) modular. En desarrollo, Vite sirve y compila el código React/TypeScript al instante. En producción, el comando npm run build genera una carpeta estática dist/ que puede servirse con Express (server.js) o subirse directamente a cualquier hosting estático.'
  );

  pdf.addTable(
    ['Ruta / Archivo', 'Responsabilidad dentro del proyecto'],
    [
      ['index.html y src/main.tsx', 'Punto de entrada HTML, tipografías (Plus Jakarta Sans, JetBrains Mono, Cormorant) y montaje de React.'],
      ['src/App.tsx', 'Núcleo de la aplicación: navegación lateral, estado global, modales principales, Dashboard, Configuración y Respaldo.'],
      ['src/types/finance.ts', 'Definiciones TypeScript de todas las entidades (Transaction, WalletAccount, CreditPurchase, WishlistItem, etc.).'],
      ['src/utils/calculations.ts', 'Motor matemático: cálculo de saldos reales, proyectados, balances por billetera y conversiones USD/VES.'],
      ['src/utils/storage.ts', 'Lectura/escritura en localStorage, validación de esquemas, exportación y fusión inteligente de respaldos JSON.'],
      ['src/utils/*Controller.ts', 'Controladores puros para Compras por Cuotas, Créditos en App, P2P, Suscripciones y Lista de Mercado.'],
      ['src/services/bcvApi.ts', 'Cliente HTTP para obtener la tasa oficial BCV desde dolarflow.com y formateadores numéricos locales.'],
      ['src/services/pushNotifications.ts', 'Centro de alertas y recordatorios locales integrados con el Service Worker (public/sw-push.js).'],
      ['src/components/*', 'Vistas especializadas: WishlistView, InstallmentsModuleView, P2PExchangeView, ChartsView, MonthlyReportPdfView, etc.'],
      ['server.js / server.ts', 'Servidor Express ligero para producción (puerto 3000 por defecto) que sirve dist/ con fallback SPA.'],
      ['vite.config.ts', 'Configuración de Vite, Tailwind v4 y VitePWA (manifiesto instalable e íconos en public/).'],
    ],
    [54, CONTENT_W - 54]
  );

  pdf.addSubheading('¿Qué función cumplen server.js y .env.example?');
  pdf.addBullet(
    'server.js (Producción):',
    'Sirve los archivos optimizados de la carpeta dist/ cuando ejecutas npm start. Incluye el endpoint GET /health que responde 200 OK.'
  );
  pdf.addBullet(
    '.env.example:',
    'Archivo plantilla del entorno original de AI Studio con GEMINI_API_KEY y APP_URL. Fuera de Gemini no necesitas configurar GEMINI_API_KEY ni ninguna clave secreta para que la app opere al 100%.'
  );

  // PÁGINA 3: MÓDULOS FUNCIONALES
  pdf.newPage();
  pdf.addSectionTitle('3', 'Mapa Completo de Módulos de la Aplicación');
  pdf.addParagraph(
    'La aplicación organiza tus finanzas en módulos accesibles desde el menú lateral, optimizados tanto para escritorio como para dispositivos móviles:'
  );

  pdf.addTable(
    ['Área / Módulo', 'Funcionalidades principales'],
    [
      ['Dashboard y Resumen', 'KPIs de patrimonio, dinero disponible real, saldo proyectado, próximo pago, flujo mensual y gráficos rápidos.'],
      ['Movimientos (Ingresos / Gastos)', 'Registro en USD o Bs con tasa BCV histórica automática por fecha, cálculo de comisiones bancarias (Pago Móvil / Transferencia) y estados Completado o Pendiente.'],
      ['Mis Billeteras y Cuentas', 'Cuentas bancarias, efectivo y tarjetas con ordenamiento personalizado, estado de cuenta estilo extracto bancario, transferencias internas y cuentas de terceros/amigos aisladas.'],
      ['Cambio P2P / USDT', 'Control de operaciones de compra/venta de divisas y USDT con cálculo de diferencial cambiario y comisiones.'],
      ['Compras por Cuota y Créditos', 'Planes BNPL (Cashea, Krece, tiendas) con barra segmentada, pago de 1 cuota, 2 cuotas, liquidación total o abono personalizado en un único movimiento bancario.'],
      ['Préstamos y Suscripciones', 'Control de dinero prestado o por pagar, gastos recurrentes (streaming, telefonía, servicios) y agenda de Próximos Pagos.'],
      ['Presupuesto, Ahorros y Metas', 'Límites de gasto por categoría, bóveda de ahorros con depósitos/retiros y seguimiento visual de metas de ahorro.'],
      ['Lista de Deseos (Wishlist)', 'Planificación de compras futuras con viabilidad frente a tu saldo real y marcado directo "Ya lo compré" en 1 clic sin registro contable obligatorio.'],
      ['Hogar, Pareja y Bienes', 'Lista de Mercado, Planificador de Menú Semanal, Bóveda de Bienes/Activos, Finanzas en Pareja y Fondo de Romance.'],
      ['Reportes, Herramientas y Temas', 'Estadísticas avanzadas, Reporte PDF Mensual imprimible, Diagnóstico de Poder Adquisitivo, Calculadora USD/Bs y más de 20 temas claros y oscuros.'],
    ],
    [56, CONTENT_W - 56]
  );

  // PÁGINA 4: EJECUCIÓN EN LOCAL FUERA DE GEMINI
  pdf.newPage();
  pdf.addSectionTitle('4', 'Cómo Ejecutar el Proyecto Fuera de Gemini (Paso a Paso)');
  pdf.addParagraph(
    'Puedes descargar todo el proyecto y ejecutarlo de forma completamente independiente en tu computadora (Windows, macOS o Linux) en menos de 5 minutos.'
  );

  pdf.addSubheading('Requisitos previos en tu equipo');
  pdf.addBullet(
    'Node.js v18 o superior (Recomendado: v20 LTS o v22 LTS):',
    'Descárgalo desde https://nodejs.org. Esto instala automáticamente los comandos node y npm.'
  );
  pdf.addBullet(
    'Editor de código o terminal (opcional):',
    'Visual Studio Code, PowerShell, CMD, Terminal de Mac o Bash.'
  );

  pdf.addSubheading('Paso 1: Obtener los archivos del proyecto');
  pdf.addParagraph(
    'Descarga el proyecto desde Google AI Studio (Export / Download ZIP o sincronización con GitHub) y descomprímelo en una carpeta de tu computadora, por ejemplo C:\\Proyectos\\mis-finanzas o ~/proyectos/mis-finanzas.'
  );

  pdf.addSubheading('Paso 2: Instalar las dependencias');
  pdf.addParagraph(
    'Abre una terminal dentro de la carpeta raíz del proyecto (donde se encuentra el archivo package.json) y ejecuta:'
  );
  pdf.addCodeBlock(['npm install'], 'Instalación estándar con npm (también compatible con bun install)');

  pdf.addSubheading('Paso 3: Levantar la aplicación en modo desarrollo');
  pdf.addParagraph('Para probar, usar o modificar el código en vivo en tu computadora ejecuta:');
  pdf.addCodeBlock(['npm run dev'], 'Inicia Vite en http://localhost:3000');
  pdf.addParagraph(
    'Luego abre tu navegador web (Chrome, Edge, Brave o Safari) y entra en http://localhost:3000 (o desde otro dispositivo en tu misma red Wi-Fi usando la IP local que muestra la terminal).'
  );

  pdf.addSubheading('Paso 4: Compilar y ejecutar en modo producción local');
  pdf.addParagraph('Si deseas correr la versión final optimizada y rápida sin servidor de desarrollo:');
  pdf.addCodeBlock(
    [
      'npm run lint      # Verifica que no existan errores de TypeScript',
      'npm run build     # Compila la app optimizada en la carpeta dist/',
      'npm start         # Inicia server.js en http://localhost:3000',
    ],
    'Flujo completo de compilación y ejecución en producción'
  );

  pdf.addCallout(
    '¿Qué pasa con el archivo .env y GEMINI_API_KEY?',
    'No necesitas crear un archivo .env ni colocar ninguna API Key de Gemini. La aplicación funciona directamente sin variables de entorno. Solo si deseas cambiar el puerto del servidor en producción (por defecto 3000), puedes ejecutar por ejemplo: PORT=8080 npm start.',
    'amber'
  );

  // PÁGINA 5: PUBLICACIÓN EN INTERNET, PWA Y MIGRACIÓN DE DATOS
  pdf.newPage();
  pdf.addSectionTitle('5', 'Publicar en Internet, Instalar como App (PWA) y Migrar Datos');

  pdf.addSubheading('Opción A: Hosting gratuito en Vercel, Netlify o Cloudflare Pages (Recomendado)');
  pdf.addParagraph(
    'Al no necesitar base de datos ni backend obligatorio, esta aplicación puede alojarse gratis como sitio estático con HTTPS automático (requisito necesario para que funcione como PWA instalable en tu celular):'
  );
  pdf.addBullet(
    '1. Sube el proyecto a un repositorio:',
    'Crea un repositorio privado o público en GitHub y sube la carpeta del proyecto.'
  );
  pdf.addBullet(
    '2. Conecta el repositorio:',
    'Inicia sesión en Vercel (vercel.com), Netlify (netlify.com) o Cloudflare Pages e importa el proyecto.'
  );
  pdf.addBullet(
    '3. Parámetros de compilación:',
    'Framework Preset: Vite | Build Command: npm run build | Output Directory: dist.'
  );
  pdf.addBullet(
    '4. ¡Listo!:',
    'Obtendrás una URL HTTPS personal para abrir tu app desde cualquier teléfono o PC.'
  );

  pdf.addSubheading('Opción B: Servidor Node.js / VPS / Render / Railway / Docker');
  pdf.addParagraph(
    'Si prefieres desplegarlo usando el servidor Express incluido (server.js), configura el servicio con Build Command: npm install && npm run build y Start Command: npm start. El servidor leerá automáticamente process.env.PORT y expondrá /health para chequeos de estado.'
  );

  pdf.addSubheading('Cómo instalarla en tu celular o PC como App (PWA)');
  pdf.addBullet(
    'Android (Chrome / Edge):',
    'Abre tu URL HTTPS -> menú de 3 puntos -> "Instalar aplicación" o "Añadir a la pantalla de inicio".'
  );
  pdf.addBullet(
    'iPhone / iPad (Safari):',
    'Abre tu URL HTTPS -> botón Compartir -> "Agregar a inicio".'
  );
  pdf.addBullet(
    'Windows / macOS (Chrome / Edge):',
    'Haz clic en el ícono de instalación en la barra de direcciones (o desde el aviso dentro de la app).'
  );

  pdf.addSubheading('Cómo llevar tus datos actuales desde AI Studio hacia tu nueva instalación');
  pdf.addCallout(
    'Migración exacta sin perder ningún movimiento',
    '1) En la versión actual dentro de AI Studio, ve a "Configuración y Respaldo" y pulsa "Descargar JSON". Guarda ese archivo .json.\n2) Abre la aplicación ejecutándose en tu computadora (localhost:3000) o en tu nuevo hosting (Vercel/Netlify).\n3) Ve a "Configuración y Respaldo" -> "Cargar JSON", selecciona el archivo descargado y elige "Reemplazar datos actuales" (o "Fusionar sin duplicados").',
    'teal'
  );

  // PÁGINA 6: SOLUCIÓN DE PROBLEMAS FRECUENTES
  pdf.newPage();
  pdf.addSectionTitle('6', 'Solución de Problemas Frecuentes y Buenas Prácticas');

  pdf.addTable(
    ['Situación / Problema', 'Causa y solución recomendada'],
    [
      ['El puerto 3000 ya está ocupado', 'Otro programa usa el puerto 3000. Ejecuta en desarrollo: npx vite --port=4000 o en producción: PORT=4000 npm start (en Windows PowerShell: $env:PORT=4000; npm start).'],
      ['No carga la tasa oficial BCV automáticamente', 'Puede deberse a falta de internet o bloqueo temporal de la API externa dolarflow.com. Activa el modo de Tasa Manual en Configuración o importa tus tasas desde un Excel/JSON en Historial de tasas.'],
      ['Abrí la app en otra URL y está vacía', 'El almacenamiento localStorage está ligado al dominio exacto (origen). Exporta tu respaldo .JSON desde el dominio anterior e impórtalo en el nuevo dominio.'],
      ['Los cambios nuevos no se ven tras actualizar', 'El Service Worker de la PWA cachea los archivos antiguos. Recarga forzando caché (Ctrl+Shift+R) o cierra y vuelve a abrir la app instalada para que autoUpdate aplique la nueva versión.'],
      ['Error al ejecutar npm install', 'Verifica que tu versión de Node.js sea 18 o superior con node -v. Si usas npm antiguo, actualiza Node o prueba eliminando node_modules y ejecutando npm install nuevamente.'],
    ],
    [56, CONTENT_W - 56]
  );

  pdf.addSubheading('Recomendaciones de seguridad y respaldo');
  pdf.addBullet(
    'Respaldos periódicos (.JSON):',
    'Dado que la aplicación guarda la información exclusivamente en el almacenamiento local del navegador, acostúmbrate a descargar un archivo .JSON semanal o mensualmente desde Configuración y Respaldo y guardarlo en Google Drive, iCloud o tu PC.'
  );
  pdf.addBullet(
    'No borres los datos de sitio del navegador:',
    'Limpiar "Cookies y datos de sitios" en Chrome/Safari borrará el localStorage del dominio. Si ocurre, podrás restaurar todo al instante cargando tu último respaldo .JSON.'
  );
  pdf.addBullet(
    'Privacidad al compartir código:',
    'El código fuente no contiene datos personales por defecto; tus registros viven únicamente en el navegador de quien usa la app.'
  );

  pdf.finalizeFooters();
  return pdf.doc;
}

export function downloadProjectGuidePdf(): void {
  const doc = createProjectGuidePdf();
  doc.save('Guia_Proyecto_MisFinanzas.pdf');
}
