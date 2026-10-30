
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "campanas": {
                  Row: {
                    "actualizado_en": string,"canales": (string)[],"config": NonNullable<Json>,"creado_en": string,"creado_por": string | null,"disparador": string,"estado": string,"id": string,"mensaje": string,"negocio_id": string,"nombre": string,"oferta_id": string | null,"programada_para": string | null,"segmento": NonNullable<Json>,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"canales"?: (string)[],"config"?: NonNullable<Json>,"creado_en"?: string,"creado_por"?: string | null,"disparador": string,"estado"?: string,"id"?: string,"mensaje": string,"negocio_id": string,"nombre": string,"oferta_id"?: string | null,"programada_para"?: string | null,"segmento"?: NonNullable<Json>,"titulo": string
                  }
                  Update: {
                    "actualizado_en"?: string,"canales"?: (string)[],"config"?: NonNullable<Json>,"creado_en"?: string,"creado_por"?: string | null,"disparador"?: string,"estado"?: string,"id"?: string,"mensaje"?: string,"negocio_id"?: string,"nombre"?: string,"oferta_id"?: string | null,"programada_para"?: string | null,"segmento"?: NonNullable<Json>,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campanas_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campanas_oferta_id_fkey"
      columns: ["oferta_id"]
isOneToOne: false
      referencedRelation: "ofertas"
      referencedColumns: ["id"]
    }
                  ]
                },"clientes": {
                  Row: {
                    "acepta_datos": boolean,"acepta_marketing": boolean,"aceptado_en": string,"actualizado_en": string,"celular": string,"celular_verificado": boolean,"creado_en": string,"fecha_nacimiento": string,"id": string,"negocio_id": string,"nombre": string,"version_politica": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acepta_datos": boolean,"acepta_marketing"?: boolean,"aceptado_en"?: string,"actualizado_en"?: string,"celular": string,"celular_verificado"?: boolean,"creado_en"?: string,"fecha_nacimiento": string,"id"?: string,"negocio_id": string,"nombre": string,"version_politica": string
                  }
                  Update: {
                    "acepta_datos"?: boolean,"acepta_marketing"?: boolean,"aceptado_en"?: string,"actualizado_en"?: string,"celular"?: string,"celular_verificado"?: boolean,"creado_en"?: string,"fecha_nacimiento"?: string,"id"?: string,"negocio_id"?: string,"nombre"?: string,"version_politica"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clientes_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"cupones": {
                  Row: {
                    "campana_id": string | null,"canjeado_en": string | null,"canjeado_por": string | null,"canjeado_sede_id": string | null,"canjeado_venta_externa_id": string | null,"codigo": string,"creado_en": string,"descripcion": string,"estado": string,"id": string,"negocio_id": string,"oferta_id": string | null,"origen": string,"tarjeta_id": string,"vence_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campana_id"?: string | null,"canjeado_en"?: string | null,"canjeado_por"?: string | null,"canjeado_sede_id"?: string | null,"canjeado_venta_externa_id"?: string | null,"codigo"?: string,"creado_en"?: string,"descripcion": string,"estado"?: string,"id"?: string,"negocio_id": string,"oferta_id"?: string | null,"origen": string,"tarjeta_id": string,"vence_en": string
                  }
                  Update: {
                    "campana_id"?: string | null,"canjeado_en"?: string | null,"canjeado_por"?: string | null,"canjeado_sede_id"?: string | null,"canjeado_venta_externa_id"?: string | null,"codigo"?: string,"creado_en"?: string,"descripcion"?: string,"estado"?: string,"id"?: string,"negocio_id"?: string,"oferta_id"?: string | null,"origen"?: string,"tarjeta_id"?: string,"vence_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cupones_campana_fk"
      columns: ["campana_id"]
isOneToOne: false
      referencedRelation: "campanas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cupones_canjeado_sede_id_fkey"
      columns: ["canjeado_sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cupones_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cupones_oferta_id_fkey"
      columns: ["oferta_id"]
isOneToOne: false
      referencedRelation: "ofertas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cupones_tarjeta_id_fkey"
      columns: ["tarjeta_id"]
isOneToOne: false
      referencedRelation: "tarjetas"
      referencedColumns: ["id"]
    }
                  ]
                },"disenos_tarjeta": {
                  Row: {
                    "actualizado_en": string,"color_etiquetas": string,"color_fondo": string,"color_texto": string,"google_clase_id": string | null,"icono_url": string | null,"imagen_banda_url": string | null,"logo_url": string | null,"negocio_id": string,"programa_id": string,"texto_cercania": string | null,"titulo": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"color_etiquetas"?: string,"color_fondo"?: string,"color_texto"?: string,"google_clase_id"?: string | null,"icono_url"?: string | null,"imagen_banda_url"?: string | null,"logo_url"?: string | null,"negocio_id": string,"programa_id": string,"texto_cercania"?: string | null,"titulo"?: string,"version"?: number
                  }
                  Update: {
                    "actualizado_en"?: string,"color_etiquetas"?: string,"color_fondo"?: string,"color_texto"?: string,"google_clase_id"?: string | null,"icono_url"?: string | null,"imagen_banda_url"?: string | null,"logo_url"?: string | null,"negocio_id"?: string,"programa_id"?: string,"texto_cercania"?: string | null,"titulo"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "disenos_tarjeta_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disenos_tarjeta_programa_id_fkey"
      columns: ["programa_id"]
isOneToOne: true
      referencedRelation: "programas"
      referencedColumns: ["id"]
    }
                  ]
                },"envios_campana": {
                  Row: {
                    "campana_id": string,"canal": string,"creado_en": string,"enviado_en": string | null,"error": string | null,"estado": string,"id": string,"negocio_id": string,"tarjeta_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campana_id": string,"canal": string,"creado_en"?: string,"enviado_en"?: string | null,"error"?: string | null,"estado"?: string,"id"?: string,"negocio_id": string,"tarjeta_id": string
                  }
                  Update: {
                    "campana_id"?: string,"canal"?: string,"creado_en"?: string,"enviado_en"?: string | null,"error"?: string | null,"estado"?: string,"id"?: string,"negocio_id"?: string,"tarjeta_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "envios_campana_campana_id_fkey"
      columns: ["campana_id"]
isOneToOne: false
      referencedRelation: "campanas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "envios_campana_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "envios_campana_tarjeta_id_fkey"
      columns: ["tarjeta_id"]
isOneToOne: false
      referencedRelation: "tarjetas"
      referencedColumns: ["id"]
    }
                  ]
                },"eventos_sello": {
                  Row: {
                    "cantidad": number,"creado_en": string,"creado_por": string | null,"id": string,"monto_venta": number | null,"negocio_id": string,"nota": string | null,"origen": string,"sede_id": string | null,"tarjeta_id": string,"venta_externa_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"creado_en"?: string,"creado_por"?: string | null,"id"?: string,"monto_venta"?: number | null,"negocio_id": string,"nota"?: string | null,"origen": string,"sede_id"?: string | null,"tarjeta_id": string,"venta_externa_id"?: string | null
                  }
                  Update: {
                    "cantidad"?: number,"creado_en"?: string,"creado_por"?: string | null,"id"?: string,"monto_venta"?: number | null,"negocio_id"?: string,"nota"?: string | null,"origen"?: string,"sede_id"?: string | null,"tarjeta_id"?: string,"venta_externa_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventos_sello_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventos_sello_sede_id_fkey"
      columns: ["sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventos_sello_tarjeta_id_fkey"
      columns: ["tarjeta_id"]
isOneToOne: false
      referencedRelation: "tarjetas"
      referencedColumns: ["id"]
    }
                  ]
                },"intentos_registro": {
                  Row: {
                    "creado_en": string,"huella": string,"id": string,"negocio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"huella": string,"id"?: string,"negocio_id": string
                  }
                  Update: {
                    "creado_en"?: string,"huella"?: string,"id"?: string,"negocio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "intentos_registro_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"llaves_api": {
                  Row: {
                    "creado_en": string,"creado_por": string | null,"hash": string,"id": string,"negocio_id": string,"nombre": string,"permisos": (string)[],"prefijo": string,"revocada_en": string | null,"ultimo_uso_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por"?: string | null,"hash": string,"id"?: string,"negocio_id": string,"nombre": string,"permisos"?: (string)[],"prefijo": string,"revocada_en"?: string | null,"ultimo_uso_en"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string | null,"hash"?: string,"id"?: string,"negocio_id"?: string,"nombre"?: string,"permisos"?: (string)[],"prefijo"?: string,"revocada_en"?: string | null,"ultimo_uso_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "llaves_api_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"miembros_negocio": {
                  Row: {
                    "creado_en": string,"negocio_id": string,"rol": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"negocio_id": string,"rol": string,"usuario_id": string
                  }
                  Update: {
                    "creado_en"?: string,"negocio_id"?: string,"rol"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "miembros_negocio_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"negocios": {
                  Row: {
                    "actualizado_en": string,"color_primario": string,"color_secundario": string,"creado_en": string,"estado": string,"hora_fin_envios": string,"hora_inicio_envios": string,"id": string,"logo_url": string | null,"max_push_semana": number,"nit": string | null,"nombre": string,"plan": string,"razon_social": string | null,"slug": string,"version_politica_datos": string,"zona_horaria": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"color_primario"?: string,"color_secundario"?: string,"creado_en"?: string,"estado"?: string,"hora_fin_envios"?: string,"hora_inicio_envios"?: string,"id"?: string,"logo_url"?: string | null,"max_push_semana"?: number,"nit"?: string | null,"nombre": string,"plan"?: string,"razon_social"?: string | null,"slug": string,"version_politica_datos"?: string,"zona_horaria"?: string
                  }
                  Update: {
                    "actualizado_en"?: string,"color_primario"?: string,"color_secundario"?: string,"creado_en"?: string,"estado"?: string,"hora_fin_envios"?: string,"hora_inicio_envios"?: string,"id"?: string,"logo_url"?: string | null,"max_push_semana"?: number,"nit"?: string | null,"nombre"?: string,"plan"?: string,"razon_social"?: string | null,"slug"?: string,"version_politica_datos"?: string,"zona_horaria"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "negocios_plan_fkey"
      columns: ["plan"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["codigo"]
    }
                  ]
                },"ofertas": {
                  Row: {
                    "activa": boolean,"actualizado_en": string,"creado_en": string,"descripcion": string | null,"id": string,"negocio_id": string,"nombre": string,"producto_ref": string | null,"tipo": string,"usos_max_por_cliente": number,"valor": number | null,"vigencia_dias": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"descripcion"?: string | null,"id"?: string,"negocio_id": string,"nombre": string,"producto_ref"?: string | null,"tipo": string,"usos_max_por_cliente"?: number,"valor"?: number | null,"vigencia_dias"?: number
                  }
                  Update: {
                    "activa"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"descripcion"?: string | null,"id"?: string,"negocio_id"?: string,"nombre"?: string,"producto_ref"?: string | null,"tipo"?: string,"usos_max_por_cliente"?: number,"valor"?: number | null,"vigencia_dias"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ofertas_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"pases_wallet": {
                  Row: {
                    "creado_en": string,"id": string,"negocio_id": string,"objeto_id": string,"plataforma": string,"sincronizado_en": string | null,"tarjeta_id": string,"token_auth": string | null,"version_diseno": number
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"id"?: string,"negocio_id": string,"objeto_id": string,"plataforma": string,"sincronizado_en"?: string | null,"tarjeta_id": string,"token_auth"?: string | null,"version_diseno"?: number
                  }
                  Update: {
                    "creado_en"?: string,"id"?: string,"negocio_id"?: string,"objeto_id"?: string,"plataforma"?: string,"sincronizado_en"?: string | null,"tarjeta_id"?: string,"token_auth"?: string | null,"version_diseno"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pases_wallet_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pases_wallet_tarjeta_id_fkey"
      columns: ["tarjeta_id"]
isOneToOne: false
      referencedRelation: "tarjetas"
      referencedColumns: ["id"]
    }
                  ]
                },"planes": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"codigo": string,"creado_en": string,"descripcion": string | null,"max_clientes": number | null,"max_sedes": number | null,"nombre": string,"orden": number,"precio_mensual": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"codigo": string,"creado_en"?: string,"descripcion"?: string | null,"max_clientes"?: number | null,"max_sedes"?: number | null,"nombre": string,"orden"?: number,"precio_mensual"?: number
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"codigo"?: string,"creado_en"?: string,"descripcion"?: string | null,"max_clientes"?: number | null,"max_sedes"?: number | null,"nombre"?: string,"orden"?: number,"precio_mensual"?: number
                  }
                  Relationships: [
                    
                  ]
                },"programas": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"creado_en": string,"id": string,"max_sellos_dia": number,"monto_minimo": number | null,"monto_por_sello": number | null,"negocio_id": string,"nombre": string,"premio_descripcion": string,"premio_vigencia_dias": number,"regla_sello": string,"sellos_requeridos": number,"vence_sellos_dias": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"id"?: string,"max_sellos_dia"?: number,"monto_minimo"?: number | null,"monto_por_sello"?: number | null,"negocio_id": string,"nombre"?: string,"premio_descripcion"?: string,"premio_vigencia_dias"?: number,"regla_sello"?: string,"sellos_requeridos"?: number,"vence_sellos_dias"?: number | null
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"id"?: string,"max_sellos_dia"?: number,"monto_minimo"?: number | null,"monto_por_sello"?: number | null,"negocio_id"?: string,"nombre"?: string,"premio_descripcion"?: string,"premio_vigencia_dias"?: number,"regla_sello"?: string,"sellos_requeridos"?: number,"vence_sellos_dias"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "programas_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"sedes": {
                  Row: {
                    "activa": boolean,"actualizado_en": string,"creado_en": string,"direccion": string | null,"id": string,"latitud": number | null,"longitud": number | null,"negocio_id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"direccion"?: string | null,"id"?: string,"latitud"?: number | null,"longitud"?: number | null,"negocio_id": string,"nombre": string
                  }
                  Update: {
                    "activa"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"direccion"?: string | null,"id"?: string,"latitud"?: number | null,"longitud"?: number | null,"negocio_id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sedes_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"superadmins": {
                  Row: {
                    "creado_en": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"usuario_id": string
                  }
                  Update: {
                    "creado_en"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"suscripciones_push": {
                  Row: {
                    "agente_usuario": string | null,"auth": string,"creado_en": string,"endpoint": string,"id": string,"negocio_id": string,"p256dh": string,"revocada_en": string | null,"tarjeta_id": string,"ultimo_uso_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agente_usuario"?: string | null,"auth": string,"creado_en"?: string,"endpoint": string,"id"?: string,"negocio_id": string,"p256dh": string,"revocada_en"?: string | null,"tarjeta_id": string,"ultimo_uso_en"?: string | null
                  }
                  Update: {
                    "agente_usuario"?: string | null,"auth"?: string,"creado_en"?: string,"endpoint"?: string,"id"?: string,"negocio_id"?: string,"p256dh"?: string,"revocada_en"?: string | null,"tarjeta_id"?: string,"ultimo_uso_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suscripciones_push_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suscripciones_push_tarjeta_id_fkey"
      columns: ["tarjeta_id"]
isOneToOne: false
      referencedRelation: "tarjetas"
      referencedColumns: ["id"]
    }
                  ]
                },"tarjetas": {
                  Row: {
                    "actualizado_en": string,"cliente_id": string,"creado_en": string,"estado": string,"id": string,"negocio_id": string,"premios_ganados": number,"programa_id": string,"sellos_actuales": number,"sellos_historicos": number,"token_publico": string,"ultima_visita_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"cliente_id": string,"creado_en"?: string,"estado"?: string,"id"?: string,"negocio_id": string,"premios_ganados"?: number,"programa_id": string,"sellos_actuales"?: number,"sellos_historicos"?: number,"token_publico"?: string,"ultima_visita_en"?: string | null
                  }
                  Update: {
                    "actualizado_en"?: string,"cliente_id"?: string,"creado_en"?: string,"estado"?: string,"id"?: string,"negocio_id"?: string,"premios_ganados"?: number,"programa_id"?: string,"sellos_actuales"?: number,"sellos_historicos"?: number,"token_publico"?: string,"ultima_visita_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tarjetas_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tarjetas_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tarjetas_programa_id_fkey"
      columns: ["programa_id"]
isOneToOne: false
      referencedRelation: "programas"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "canjear_cupon":
{ Args: { "p_canjeado_por"?: string,"p_codigo": string,"p_negocio_id": string,"p_sede_id"?: string,"p_venta_externa_id"?: string }; Returns: Json
                           },
"clientes_negocio":
{ Args: { "p_busqueda"?: string,"p_desde"?: number,"p_filtro"?: string,"p_limite"?: number,"p_negocio_id": string,"p_orden"?: string }; Returns: {
              "acepta_marketing": boolean,"aceptado_en": string,"celular": string,"celular_verificado": boolean,"creado_en": string,"cupones_vigentes": number,"estado_tarjeta": string,"fecha_nacimiento": string,"id": string,"nombre": string,"premios_ganados": number,"sellos_actuales": number,"sellos_historicos": number,"sellos_requeridos": number,"tarjeta_id": string,"total": number,"ultima_visita_en": string,"version_politica": string
            }[]
                           },
"clientes_resumen":
{ Args: { "p_negocio_id": string }; Returns: Json
                           },
"club_registrar":
{ Args: { "p_acepta_marketing": boolean,"p_celular": string,"p_fecha_nacimiento": string,"p_huella_ip": string,"p_nombre": string,"p_slug": string }; Returns: Json
                           },
"crear_negocio":
{ Args: { "p_nombre": string,"p_slug": string,"p_zona_horaria"?: string }; Returns: string
                           },
"equipo_negocio":
{ Args: { "p_negocio_id": string }; Returns: {
              "creado_en": string,"email": string,"invitacion_pendiente": boolean,"rol": string,"ultimo_ingreso_en": string,"usuario_id": string
            }[]
                           },
"registrar_sello":
{ Args: { "p_creado_por"?: string,"p_monto_venta"?: number,"p_negocio_id": string,"p_origen"?: string,"p_sede_id"?: string,"p_token_tarjeta": string,"p_unidades"?: number,"p_venta_externa_id": string }; Returns: Json
                           },
"superadmin_actualizar_negocio":
{ Args: { "p_estado": string,"p_negocio_id": string,"p_plan": string }; Returns: undefined
                           },
"superadmin_agregar":
{ Args: { "p_email": string }; Returns: string
                           },
"superadmin_clientes":
{ Args: { "p_busqueda"?: string,"p_desde"?: number,"p_limite"?: number,"p_negocio_id"?: string }; Returns: {
              "acepta_marketing": boolean,"celular": string,"creado_en": string,"fecha_nacimiento": string,"id": string,"negocio_estado": string,"negocio_id": string,"negocio_logo_url": string,"negocio_nombre": string,"negocio_slug": string,"nombre": string,"premios_ganados": number,"sellos_historicos": number,"total": number,"ultima_visita_en": string
            }[]
                           },
"superadmin_eliminar_negocio":
{ Args: { "p_confirmacion": string,"p_negocio_id": string }; Returns: undefined
                           },
"superadmin_equipo":
{ Args: { "p_busqueda"?: string }; Returns: {
              "creado_en": string,"email": string,"ultimo_ingreso_en": string,"usuario_id": string
            }[]
                           },
"superadmin_negocios":
{ Args: { "p_dias"?: number }; Returns: {
              "canjes_periodo": number,"clientes": number,"clientes_nuevos": number,"creado_en": string,"dueno_email": string,"estado": string,"id": string,"logo_url": string,"miembros": number,"nombre": string,"plan": string,"sedes": number,"sellos_periodo": number,"slug": string,"ultimo_sello_en": string,"zona_horaria": string
            }[]
                           },
"superadmin_quitar":
{ Args: { "p_usuario_id": string }; Returns: undefined
                           },
"superadmin_tablero":
{ Args: { "p_dias"?: number }; Returns: Json
                           },
"usuario_por_email":
{ Args: { "p_email": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
