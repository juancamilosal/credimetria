import { ConfigColeccion, opciones } from './config';

const PRODUCTOS = opciones([
  ['libranza', 'Libranza'],
  ['libre-inversion', 'Libre inversión'],
  ['vehiculo', 'Vehículo'],
  ['vivienda', 'Vivienda'],
  ['vivienda-vis', 'Crédito hipotecario VIS'],
  ['vivienda-no-vis', 'Crédito hipotecario No VIS'],
  ['leasing-vis', 'Leasing habitacional VIS'],
  ['leasing-no-vis', 'Leasing habitacional No VIS'],
]);

const nombreCompleto = (r: Record<string, unknown>) =>
  [r['nombres'], r['apellidos']].filter(Boolean).join(' ') || 'Prospecto';

/** Solicitudes de asesoría que llegan del formulario /asesoria. */
export const PROSPECTOS: ConfigColeccion = {
  coleccion: 'prospectos',
  titulo: 'Prospectos',
  texto:
    'Las personas que pidieron asesoría. Márcalas como contactadas o descartadas y deja notas.',
  nombre: 'prospecto',
  llave: 'id',
  orden: '-date_created',
  crear: true,
  buscar: ['nombres', 'apellidos', 'celular', 'correo', 'ciudad'],
  estado: {
    campo: 'estado',
    opciones: opciones([
      ['nuevo', 'Nuevo'],
      ['contactado', 'Contactado'],
      ['descartado', 'Descartado'],
    ]),
  },
  tituloRegistro: nombreCompleto,
  columnas: [
    { campo: 'date_created', etiqueta: 'Fecha', como: 'fecha' },
    { campo: 'nombres', etiqueta: 'Nombres' },
    { campo: 'apellidos', etiqueta: 'Apellidos' },
    { campo: 'producto', etiqueta: 'Producto' },
    { campo: 'ciudad', etiqueta: 'Ciudad' },
    { campo: 'celular', etiqueta: 'Celular' },
    { campo: 'estado', etiqueta: 'Estado', como: 'estado' },
  ],
  campos: [
    {
      campo: 'date_created',
      etiqueta: 'Llegó',
      tipo: 'fecha',
      soloLectura: true,
    },
    {
      campo: 'estado',
      etiqueta: 'Estado',
      tipo: 'opciones',
      opciones: opciones([
        ['nuevo', 'Nuevo'],
        ['contactado', 'Contactado'],
        ['descartado', 'Descartado'],
      ]),
    },
    { campo: 'nombres', etiqueta: 'Nombres', tipo: 'texto', obligatorio: true },
    {
      campo: 'apellidos',
      etiqueta: 'Apellidos',
      tipo: 'texto',
      obligatorio: true,
    },
    { campo: 'celular', etiqueta: 'Celular', tipo: 'telefono' },
    { campo: 'correo', etiqueta: 'Correo', tipo: 'correo' },
    {
      campo: 'producto',
      etiqueta: 'Producto',
      tipo: 'opciones',
      opciones: PRODUCTOS,
    },
    { campo: 'monto', etiqueta: 'Monto', tipo: 'numero' },
    { campo: 'ciudad', etiqueta: 'Ciudad', tipo: 'texto' },
    {
      campo: 'urgencia',
      etiqueta: 'Cuándo lo necesita',
      tipo: 'opciones',
      opciones: opciones([
        ['ya', 'Ya'],
        ['mes', 'Este mes'],
        ['tres', 'En 3 meses'],
      ]),
    },
    {
      campo: 'entidad',
      etiqueta: 'Entidad elegida en el ranking',
      tipo: 'texto',
    },
    { campo: 'canales', etiqueta: 'Canales', tipo: 'json', soloLectura: true },
    { campo: 'notas', etiqueta: 'Notas', tipo: 'area', ancho: true },
    {
      campo: 'autorizacion',
      etiqueta: 'Prueba de la autorización',
      tipo: 'json',
      soloLectura: true,
      ancho: true,
    },
  ],
};

/** Asesores aliados (los publicados salen en /aliados). */
export const ASESORES: ConfigColeccion = {
  coleccion: 'asesores',
  titulo: 'Asesores aliados',
  texto:
    'Los publicados salen en credimetria.com/aliados y pueden recibir solicitudes. Cédula, celular, correo y notas no se publican.',
  nombre: 'asesor',
  llave: 'id',
  llaveManual: true,
  orden: 'orden,nombre',
  crear: true,
  buscar: ['nombre', 'empresa', 'correo', 'celular'],
  estado: {
    campo: 'estado',
    opciones: opciones([
      ['publicado', 'Publicado'],
      ['borrador', 'Borrador'],
      ['retirado', 'Retirado'],
    ]),
  },
  tituloRegistro: (r) => String(r['nombre'] ?? 'Asesor'),
  columnas: [
    { campo: 'foto', etiqueta: 'Foto', como: 'foto' },
    { campo: 'nombre', etiqueta: 'Nombre' },
    { campo: 'empresa', etiqueta: 'Empresa' },
    { campo: 'verificado', etiqueta: 'Verificado', como: 'si-no' },
    { campo: 'estado', etiqueta: 'Estado', como: 'estado' },
  ],
  campos: [
    {
      campo: 'id',
      etiqueta: 'Identificador',
      tipo: 'texto',
      obligatorio: true,
      soloAlCrear: true,
      ayuda:
        'En minúsculas y con guiones, por ejemplo ana-gomez-rojas. No cambia después.',
    },
    {
      campo: 'estado',
      etiqueta: 'Estado',
      tipo: 'opciones',
      opciones: opciones([
        ['publicado', 'Publicado'],
        ['borrador', 'Borrador'],
        ['retirado', 'Retirado'],
      ]),
    },
    { campo: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
    { campo: 'empresa', etiqueta: 'Empresa', tipo: 'texto' },
    {
      campo: 'verificado',
      etiqueta: 'Verificado (mostró su vínculo)',
      tipo: 'booleano',
    },
    { campo: 'orden', etiqueta: 'Orden en la página', tipo: 'numero' },
    {
      campo: 'foto',
      etiqueta: 'Foto',
      tipo: 'imagen',
      carpeta: 'Asesores',
      ayuda: 'Solo con su autorización. En la página se recorta cuadrada.',
      ancho: true,
    },
    { campo: 'entidades', etiqueta: 'Entidades', tipo: 'lista', ancho: true },
    { campo: 'productos', etiqueta: 'Productos', tipo: 'lista', ancho: true },
    { campo: 'ciudades', etiqueta: 'Ciudades', tipo: 'lista', ancho: true },
    { campo: 'cedula', etiqueta: 'Cédula (privado)', tipo: 'texto' },
    { campo: 'celular', etiqueta: 'Celular (privado)', tipo: 'telefono' },
    { campo: 'correo', etiqueta: 'Correo (privado)', tipo: 'correo' },
    { campo: 'fecha_ingreso', etiqueta: 'Fecha de ingreso', tipo: 'fecha' },
    { campo: 'notas', etiqueta: 'Notas (privado)', tipo: 'area', ancho: true },
  ],
};

const TIPOS_ALIADO = opciones([
  ['independiente', 'Asesor independiente'],
  ['fuerza_ventas', 'Fuerza de ventas'],
  ['empleado_entidad', 'Empleado de la entidad'],
  ['empresa', 'Empresa asesora'],
]);

/** "Quiero ser aliado": asesores que piden entrar. */
export const SOLICITUDES: ConfigColeccion = {
  coleccion: 'solicitudes_aliados',
  titulo: 'Solicitudes de aliados',
  texto:
    'Asesores que pidieron ser aliados desde la página. Revísalas y, si las apruebas, crea el asesor con sus datos.',
  nombre: 'solicitud',
  llave: 'id',
  orden: '-date_created',
  crear: false,
  buscar: ['nombre', 'correo', 'celular', 'empresa', 'ciudad'],
  estado: {
    campo: 'estado',
    opciones: opciones([
      ['nueva', 'Nueva'],
      ['en_revision', 'En revisión'],
      ['aprobada', 'Aprobada'],
      ['rechazada', 'Rechazada'],
    ]),
  },
  tituloRegistro: (r) => String(r['nombre'] ?? 'Solicitud'),
  columnas: [
    { campo: 'date_created', etiqueta: 'Fecha', como: 'fecha' },
    { campo: 'nombre', etiqueta: 'Nombre' },
    { campo: 'tipo', etiqueta: 'Tipo' },
    { campo: 'ciudad', etiqueta: 'Vive en' },
    { campo: 'celular', etiqueta: 'Celular' },
    { campo: 'estado', etiqueta: 'Estado', como: 'estado' },
  ],
  campos: [
    {
      campo: 'date_created',
      etiqueta: 'Llegó',
      tipo: 'fecha',
      soloLectura: true,
    },
    {
      campo: 'estado',
      etiqueta: 'Estado',
      tipo: 'opciones',
      opciones: opciones([
        ['nueva', 'Nueva'],
        ['en_revision', 'En revisión'],
        ['aprobada', 'Aprobada'],
        ['rechazada', 'Rechazada'],
      ]),
    },
    { campo: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    { campo: 'cedula', etiqueta: 'Cédula', tipo: 'texto' },
    { campo: 'celular', etiqueta: 'Celular', tipo: 'telefono' },
    { campo: 'correo', etiqueta: 'Correo', tipo: 'correo' },
    { campo: 'ciudad', etiqueta: 'Vive en', tipo: 'texto' },
    {
      campo: 'tipo',
      etiqueta: 'Tipo',
      tipo: 'opciones',
      opciones: TIPOS_ALIADO,
    },
    { campo: 'empresa', etiqueta: 'Empresa', tipo: 'texto' },
    { campo: 'experiencia', etiqueta: 'Años de experiencia', tipo: 'numero' },
    { campo: 'entidades', etiqueta: 'Entidades', tipo: 'lista', ancho: true },
    { campo: 'productos', etiqueta: 'Productos', tipo: 'lista', ancho: true },
    {
      campo: 'ciudades',
      etiqueta: 'Ciudades donde atiende',
      tipo: 'lista',
      ancho: true,
    },
    {
      campo: 'vinculo',
      etiqueta: 'Demuestra su vínculo con',
      tipo: 'opciones',
      opciones: opciones([
        ['carta', 'Carta de la entidad'],
        ['certificado', 'Certificado'],
        ['contrato', 'Contrato'],
        ['otro', 'Otro'],
      ]),
    },
    {
      campo: 'acepta_reglas',
      etiqueta: 'Aceptó las 5 reglas',
      tipo: 'booleano',
      soloLectura: true,
    },
    {
      campo: 'mensaje',
      etiqueta: 'Mensaje',
      tipo: 'area',
      soloLectura: true,
      ancho: true,
    },
    { campo: 'notas', etiqueta: 'Notas', tipo: 'area', ancho: true },
    {
      campo: 'autorizacion',
      etiqueta: 'Prueba de la autorización',
      tipo: 'json',
      soloLectura: true,
      ancho: true,
    },
  ],
};

/** Reportes (quejas) contra asesores, desde /aliados/reportar. */
export const REPORTES: ConfigColeccion = {
  coleccion: 'reportes_asesores',
  titulo: 'Reportes de asesores',
  texto:
    'Quejas de personas contra asesores. Revísalas, deja notas y, si el asesor incumplió, retíralo en Asesores.',
  nombre: 'reporte',
  llave: 'id',
  orden: '-date_created',
  crear: false,
  buscar: ['nombre', 'correo', 'asesor_nombre', 'descripcion'],
  estado: {
    campo: 'estado',
    opciones: opciones([
      ['nuevo', 'Nuevo'],
      ['en_revision', 'En revisión'],
      ['resuelto', 'Resuelto'],
      ['descartado', 'Descartado'],
    ]),
  },
  tituloRegistro: (r) => `Reporte de ${r['nombre'] ?? 'una persona'}`,
  columnas: [
    { campo: 'date_created', etiqueta: 'Fecha', como: 'fecha' },
    { campo: 'asesor', etiqueta: 'Asesor' },
    { campo: 'asesor_nombre', etiqueta: 'Nombre escrito' },
    { campo: 'motivo', etiqueta: 'Motivo' },
    { campo: 'nombre', etiqueta: 'Reporta' },
    { campo: 'estado', etiqueta: 'Estado', como: 'estado' },
  ],
  campos: [
    {
      campo: 'date_created',
      etiqueta: 'Llegó',
      tipo: 'fecha',
      soloLectura: true,
    },
    {
      campo: 'estado',
      etiqueta: 'Estado',
      tipo: 'opciones',
      opciones: opciones([
        ['nuevo', 'Nuevo'],
        ['en_revision', 'En revisión'],
        ['resuelto', 'Resuelto'],
        ['descartado', 'Descartado'],
      ]),
    },
    {
      campo: 'asesor',
      etiqueta: 'Asesor',
      tipo: 'relacion',
      relacion: { coleccion: 'asesores', etiqueta: 'nombre' },
    },
    {
      campo: 'asesor_nombre',
      etiqueta: 'Nombre que escribió (si no está en la lista)',
      tipo: 'texto',
    },
    {
      campo: 'motivo',
      etiqueta: 'Motivo',
      tipo: 'opciones',
      opciones: opciones([
        ['cobro_adelantado', 'Le pidió dinero por adelantado'],
        ['datos', 'Usó o compartió sus datos sin permiso'],
        ['horario_canal', 'Fuera de horario o por otro canal'],
        ['suplantacion', 'Se hizo pasar por el banco o Credimetría'],
        ['trato', 'Mal trato o información falsa'],
        ['otro', 'Otro'],
      ]),
    },
    { campo: 'fecha_contacto', etiqueta: 'Fecha del contacto', tipo: 'fecha' },
    {
      campo: 'descripcion',
      etiqueta: 'Lo que pasó',
      tipo: 'area',
      soloLectura: true,
      ancho: true,
    },
    { campo: 'nombre', etiqueta: 'Quién reporta', tipo: 'texto' },
    { campo: 'correo', etiqueta: 'Correo', tipo: 'correo' },
    { campo: 'celular', etiqueta: 'Celular', tipo: 'telefono' },
    { campo: 'notas', etiqueta: 'Notas', tipo: 'area', ancho: true },
    {
      campo: 'autorizacion',
      etiqueta: 'Prueba de la autorización',
      tipo: 'json',
      soloLectura: true,
      ancho: true,
    },
  ],
};
