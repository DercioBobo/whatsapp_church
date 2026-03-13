# Copyright (c) 2026, Entretech and contributors
# For license information, please see license.txt

import json
import random
import time
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime, get_datetime, add_days


def parse_contacto(raw):
    """Split a contacto string like '862872288 / 852872288' into individual numbers."""
    if not raw:
        return []
    parts = raw.split("/")
    numbers = []
    for p in parts:
        n = p.strip()
        if n:
            numbers.append(n)
    return numbers


def normalize_mz_number(num):
    """Auto-prepend MZ country code (258) if not already present."""
    n = num.strip().replace(" ", "").replace("-", "")
    if not n:
        return n
    if n.startswith("+258"):
        return "258" + n[4:]
    if n.startswith("258"):
        return n
    return "258" + n


def _parse_numero_nome(line):
    """
    Parse a single input line into (phone_string, name_string).

    Supported formats (checked in order):
      848888888 Joao          space separator  — name must contain a letter
      848888888 - Maria       dash separator   — "number - name"
      848888888,Ana           comma separator  — name must contain a letter
      848888888\tPedro        tab separator
      848888888               number only      — name is ''

    Returns (None, '') for blank lines.
    Backward-compatible: "848888888,858888888" (two bare numbers, no letters after comma)
    is returned as ('848888888,858888888', '') so the caller can split on comma.
    """
    import re
    line = line.strip()
    if not line:
        return None, ''

    # 1. Tab separator (unambiguous)
    if '\t' in line:
        parts = line.split('\t', 1)
        return parts[0].strip(), parts[1].strip()

    # 2. " - " separator (space-dash-space): "number - name"
    if ' - ' in line:
        idx = line.index(' - ')
        num_part = line[:idx].strip()
        name_part = line[idx + 3:].strip()
        if num_part and name_part:
            return num_part, name_part

    # 3. Comma separator — only when the part after the comma contains a letter
    if ',' in line:
        idx = line.index(',')
        after = line[idx + 1:].strip()
        if re.search(r'[a-zA-Z\u00C0-\u00FF]', after):
            return line[:idx].strip(), after

    # 4. Space separator — first token must be 7+ pure digits (+ optional leading +/258)
    #    and the rest must contain at least one letter (otherwise it's part of the number)
    parts = line.split(None, 1)
    if len(parts) == 2:
        first, rest = parts[0], parts[1].strip()
        first_digits = re.sub(r'[+\s]', '', first)
        if first_digits.isdigit() and len(first_digits) >= 7 and re.search(r'[a-zA-Z\u00C0-\u00FF]', rest):
            return first, rest

    # No name found — entire line is the number
    return line, ''


def _build_extra_filters(fonte):
    """Return list of Frappe filter tuples from filtros JSON or legacy fields."""
    # Try new filtros JSON field first
    filtros_json = getattr(fonte, "filtros", None)
    if filtros_json:
        try:
            filtros = json.loads(filtros_json)
            result = []
            for f in filtros:
                campo = (f.get("campo") or "").strip()
                if not campo:
                    continue
                op = (f.get("operador") or "=").strip()
                valor = (f.get("valor") or "")
                if op == "is not set":
                    result.append([campo, "is", "not set"])
                elif op == "is set":
                    result.append([campo, "is", "set"])
                else:
                    result.append([campo, op, valor])
            return result
        except Exception:
            pass
    # Backward compat: read legacy single filter fields
    campo = getattr(fonte, "filtro_campo", None)
    if not campo:
        return []
    op = (getattr(fonte, "filtro_operador", None) or "=").strip()
    valor = getattr(fonte, "filtro_valor", None) or ""
    if op == "is not set":
        return [[campo, "is", "not set"]]
    if op == "is set":
        return [[campo, "is", "set"]]
    return [[campo, op, valor]]


def resolver_fontes_list(fontes):
    """
    Shared helper: resolve a list of Aviso WhatsApp Fonte rows to recipient dicts.
    Used by both AvisoWhatsApp and ConversaWhatsApp.
    """
    dummy = AvisoWhatsApp.__new__(AvisoWhatsApp)
    seen = set()
    result = []
    for fonte in (fontes or []):
        for r in dummy._resolver_fonte(fonte):
            c = (r.get("contacto") or "").strip()
            if c and c not in seen:
                seen.add(c)
                result.append(r)
    return result


def _render_mensagem_para_dest(mensagem, dest):
    """
    Shared helper: render a Jinja2 message template for a specific recipient dict.
    Used by both AvisoWhatsApp and ConversaWhatsApp.
    """
    if not mensagem:
        return ""
    if "{{" not in mensagem:
        return mensagem
    try:
        context = {
            "nome": dest.get("nome", ""),
            "contacto": dest.get("contacto", ""),
            "origem": dest.get("origem", ""),
            "number_owner": dest.get("number_owner", dest.get("nome", "")),
            "doc": dest.get("doc"),
        }
        return frappe.render_template(mensagem, context)
    except Exception as e:
        frappe.log_error(message=str(e), title="Render Mensagem - Erro")
        return mensagem


@frappe.whitelist()
def preview_mensagens(aviso_name, limit=5, offset=0):
    """Resolve all recipients for a saved Aviso and return rendered messages for a page of them."""
    doc = frappe.get_doc("Aviso WhatsApp", aviso_name)
    all_recipients = doc.resolver_destinatarios()
    total = len(all_recipients)
    limit = int(limit)
    offset = int(offset)
    page = all_recipients[offset:offset + limit]
    result = []
    for dest in page:
        result.append({
            "nome": dest.get("nome", "") or "",
            "contacto": dest.get("contacto", "") or "",
            "origem": dest.get("origem", "") or "",
            "mensagem": doc._render_mensagem(dest),
        })
    return {"recipients": result, "total": total, "offset": offset}


@frappe.whitelist()
def get_falhados_aviso(aviso_name):
    """Return deduplicated failed recipients across all Envio em Massa logs for this aviso."""
    envios = frappe.get_all(
        "Envio em Massa WhatsApp",
        filters={"aviso": aviso_name},
        pluck="name",
        limit_page_length=0
    )
    if not envios:
        return []
    falhados = frappe.get_all(
        "Envio em Massa Log",
        filters={"envio": ["in", envios], "status": "Falhado"},
        fields=["numero", "nome", "erro"],
        order_by="nome asc",
        limit_page_length=0
    )
    # Deduplicate by numero — keep first occurrence
    seen = set()
    result = []
    for f in falhados:
        if f.numero and f.numero not in seen:
            seen.add(f.numero)
            result.append(f)
    return result


@frappe.whitelist()
def preview_fonte_destinatarios(fonte_json):
    """Return resolved phone numbers for a single fonte definition (preview before saving)."""
    fonte = frappe._dict(json.loads(fonte_json))
    doc = frappe.new_doc("Aviso WhatsApp")
    recipients = doc._resolver_fonte(fonte)
    return [{"nome": r.get("nome", ""), "contacto": r.get("contacto", "")} for r in recipients]


@frappe.whitelist()
def get_doctype_phone_fields(doctype):
    """Return Data/Phone field names for the given DocType (used in JS picker)."""
    try:
        meta = frappe.get_meta(doctype)
    except Exception:
        return []
    return [
        {"fieldname": f.fieldname, "label": f.label or f.fieldname}
        for f in meta.fields
        if f.fieldtype in ("Data", "Phone")
    ]


@frappe.whitelist()
def get_doctype_child_tables(doctype):
    """Return Table field names for the given DocType (used in JS picker)."""
    try:
        meta = frappe.get_meta(doctype)
    except Exception:
        return []
    return [
        {"fieldname": f.fieldname, "label": f.label or f.fieldname, "options": f.options}
        for f in meta.fields
        if f.fieldtype == "Table"
    ]


@frappe.whitelist()
def get_doctype_all_fields(doctype):
    """Return all filterable fields for a DocType (for filter field picker)."""
    try:
        meta = frappe.get_meta(doctype)
    except Exception:
        return []
    excluded = {"Section Break", "Column Break", "HTML", "Button", "Fold",
                "Heading", "Tab Break", "Table", "Table MultiSelect"}
    return [
        {"fieldname": f.fieldname, "label": f.label or f.fieldname, "fieldtype": f.fieldtype}
        for f in meta.fields
        if f.fieldtype not in excluded
    ]


def processar_avisos_agendados():
    """Called by scheduler every 15 minutes. Finds due Avisos and enqueues them."""
    now = now_datetime()
    avisos = frappe.get_list(
        "Aviso WhatsApp",
        filters=[
            ["status", "in", ["Agendado", "Recorrente"]],
            ["proximo_envio", "<=", now]
        ],
        fields=["name"],
        limit_page_length=0
    )
    for aviso in avisos:
        frappe.enqueue(
            "whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp._executar_aviso_agendado",
            aviso_name=aviso.name,
            queue="long",
            timeout=14400  # 4 hours
        )


def _executar_aviso_agendado(aviso_name, disparado_por="Agendado"):
    """Background worker: load doc and run the send loop."""
    try:
        doc = frappe.get_doc("Aviso WhatsApp", aviso_name)
        doc._enviar(disparado_por=disparado_por)
    except Exception:
        frappe.log_error(
            message=frappe.get_traceback(),
            title="Aviso WhatsApp - Erro Agendado: {}".format(aviso_name)
        )


def _bulk_insert_logs(envio_name, rendered_list):
    """Bulk-insert Envio em Massa Log rows using direct SQL for performance."""
    if not rendered_list:
        return
    now_str = str(frappe.utils.now_datetime())
    owner = frappe.session.user or "Administrator"
    rows = []
    for dest in rendered_list:
        rows.append((
            frappe.generate_hash(length=10),
            envio_name,
            (dest.get("numero") or ""),
            (dest.get("nome") or "")[:140],
            (dest.get("origem") or "")[:140],
            (dest.get("mensagem_renderizada") or ""),
            "Pendente",
            now_str, now_str, owner, owner, 0
        ))
    fields = ["name", "envio", "numero", "nome", "origem", "mensagem_renderizada",
              "status", "creation", "modified", "owner", "modified_by", "docstatus"]
    frappe.db.bulk_insert("Envio em Massa Log", fields=fields, values=rows)
    frappe.db.commit()


def _enviar_em_massa(envio_name, aviso_name, disparado_por="Manual"):
    """Background worker: send pending log rows, update progress, support resume."""
    from whatsapp_notifications.whatsapp_notifications.api import send_whatsapp, send_whatsapp_media
    from whatsapp_notifications.whatsapp_notifications.doctype.evolution_api_settings.evolution_api_settings import get_settings

    try:
        envio = frappe.get_doc("Envio em Massa WhatsApp", envio_name)
        aviso = frappe.get_doc("Aviso WhatsApp", aviso_name)
    except frappe.DoesNotExistError:
        frappe.log_error(title="Envio em Massa - Doc não encontrado", message=envio_name)
        return

    # Mark as running
    frappe.db.set_value("Envio em Massa WhatsApp", envio_name, {
        "status": "Em Execução",
        "ultimo_heartbeat": frappe.utils.now_datetime()
    })
    frappe.db.commit()

    # Load all pending recipients
    pending = frappe.get_all(
        "Envio em Massa Log",
        filters={"envio": envio_name, "status": "Pendente"},
        fields=["name", "numero", "nome", "origem", "mensagem_renderizada"],
        order_by="creation asc",
        limit_page_length=0
    )

    if not pending:
        frappe.db.set_value("Envio em Massa WhatsApp", envio_name, {
            "status": "Concluído",
            "concluido_em": frappe.utils.now_datetime()
        })
        frappe.db.commit()
        return

    # Rate limiting settings
    settings = get_settings()
    rate_limit_on = settings.get("enable_rate_limiting")
    msgs_per_min = max(1, settings.get("messages_per_minute") or 20)
    delay_base = (60.0 / msgs_per_min) if rate_limit_on else 0

    has_attachment = bool(envio.anexo)
    enviados = 0
    falhados = 0
    heartbeat_counter = 0

    for i, log in enumerate(pending):
        if i > 0 and delay_base:
            time.sleep(delay_base * random.uniform(0.75, 1.25))

        numero = (log.numero or "").strip()
        if not numero:
            frappe.db.set_value("Envio em Massa Log", log.name, {
                "status": "Falhado",
                "erro": "Número vazio"
            })
            falhados += 1
            frappe.db.sql(
                "UPDATE `tabEnvio em Massa WhatsApp` SET falhados=falhados+1, pendentes=pendentes-1 WHERE name=%s",
                envio_name
            )
            frappe.db.commit()
            continue

        try:
            mensagem = log.mensagem_renderizada or ""
            if has_attachment:
                result = send_whatsapp_media(
                    phone=numero,
                    doctype="Aviso WhatsApp",
                    docname=aviso_name,
                    file_url=envio.anexo,
                    caption=mensagem,
                    queue=False
                )
            else:
                result = send_whatsapp(
                    phone=numero,
                    message=mensagem,
                    doctype="Aviso WhatsApp",
                    docname=aviso_name,
                    queue=False
                )

            if result and result.get("success"):
                frappe.db.set_value("Envio em Massa Log", log.name, {
                    "status": "Enviado",
                    "enviado_em": frappe.utils.now_datetime()
                })
                enviados += 1
                frappe.db.sql(
                    "UPDATE `tabEnvio em Massa WhatsApp` SET enviados=enviados+1, pendentes=pendentes-1 WHERE name=%s",
                    envio_name
                )
            else:
                err = (result or {}).get("error") or "Send returned failure"
                frappe.db.set_value("Envio em Massa Log", log.name, {
                    "status": "Falhado",
                    "erro": str(err)[:500]
                })
                falhados += 1
                frappe.db.sql(
                    "UPDATE `tabEnvio em Massa WhatsApp` SET falhados=falhados+1, pendentes=pendentes-1 WHERE name=%s",
                    envio_name
                )
        except Exception as e:
            frappe.db.set_value("Envio em Massa Log", log.name, {
                "status": "Falhado",
                "erro": str(e)[:500]
            })
            falhados += 1
            frappe.db.sql(
                "UPDATE `tabEnvio em Massa WhatsApp` SET falhados=falhados+1, pendentes=pendentes-1 WHERE name=%s",
                envio_name
            )
            frappe.log_error(
                message="{} -> {}".format(numero, str(e)),
                title="Envio em Massa - Erro Envio"
            )

        # Heartbeat every 10 messages
        heartbeat_counter += 1
        if heartbeat_counter % 10 == 0:
            frappe.db.set_value("Envio em Massa WhatsApp", envio_name, "ultimo_heartbeat", frappe.utils.now_datetime())

        frappe.db.commit()

    # Final state
    final_status = "Concluído" if falhados == 0 else ("Falhado" if enviados == 0 else "Concluído")
    frappe.db.set_value("Envio em Massa WhatsApp", envio_name, {
        "status": final_status,
        "concluido_em": frappe.utils.now_datetime()
    })
    frappe.db.commit()

    # Register history on the aviso
    try:
        aviso.reload()
        total = enviados + falhados
        aviso.registar_historico(
            enviados=enviados,
            falhados=falhados,
            total=total,
            disparado_por=disparado_por
        )

        proximo = aviso.calcular_proximo_envio(after_send=True)
        if proximo:
            novo_status = "Recorrente" if aviso.modo_recorrencia in ("Intervalo", "Datas") else "Agendado"
            aviso.db_set("proximo_envio", proximo)
            aviso.db_set("status", novo_status)
        else:
            new_status = "Enviado" if aviso.tipo_envio == "Agora" else "Concluído"
            aviso.db_set("status", new_status)
        frappe.db.commit()
    except Exception:
        frappe.log_error(title="Envio em Massa - Erro registar histórico", message=frappe.get_traceback())


class AvisoWhatsApp(Document):

    def validate(self):
        if not self.titulo:
            frappe.throw(_("O título do aviso é obrigatório."))
        if not self.fontes:
            frappe.throw(_("Adicione pelo menos uma fonte de destinatários."))
        if self.tipo_envio == "Agendar":
            if not self.data_envio:
                frappe.throw(_("Indique a data de envio para agendamento."))
            if self.modo_recorrencia == "Intervalo":
                if not self.intervalo_valor or self.intervalo_valor < 1:
                    frappe.throw(_("Indique um intervalo válido (>= 1)."))
                if not self.intervalo_tipo:
                    frappe.throw(_("Indique o tipo de intervalo (dias/semanas/meses)."))
            if self.modo_recorrencia == "Datas":
                if not self.datas_especificas:
                    frappe.throw(_("Indique pelo menos uma data específica."))

    @frappe.whitelist()
    def enviar_agora(self, disparado_por="Manual"):
        """Validate, resolve recipients, create monitoring doc, and queue background send."""
        if self.status == "Enviando":
            frappe.throw(_("Envio já em curso."))

        if not self.mensagem and not self.anexo:
            frappe.throw(_("Escreva a mensagem ou anexe um ficheiro."))

        # Resolve and pre-render all recipients before enqueuing
        destinatarios = self.resolver_destinatarios()
        if not destinatarios:
            frappe.throw(_("Nenhum destinatário encontrado nas fontes configuradas."))

        # Pre-render messages (so resume doesn't need the full doc context)
        rendered = []
        for dest in destinatarios:
            rendered.append({
                "numero": dest.get("contacto", ""),
                "nome": dest.get("nome", "") or "",
                "origem": dest.get("origem", "") or "",
                "mensagem_renderizada": self._render_mensagem(dest),
            })

        # Create the Envio em Massa monitor doc
        envio = frappe.new_doc("Envio em Massa WhatsApp")
        envio.aviso = self.name
        envio.titulo = self.titulo or self.name
        envio.status = "Preparando"
        envio.total = len(rendered)
        envio.enviados = 0
        envio.falhados = 0
        envio.pendentes = len(rendered)
        envio.disparado_por = disparado_por
        envio.iniciado_em = frappe.utils.now_datetime()
        envio.anexo = self.anexo or ""
        envio.insert(ignore_permissions=True)
        frappe.db.commit()

        # Bulk-insert log rows via direct SQL for performance
        _bulk_insert_logs(envio.name, rendered)

        self.db_set("status", "Enviando")
        frappe.db.commit()

        frappe.enqueue(
            "whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp._enviar_em_massa",
            envio_name=envio.name,
            aviso_name=self.name,
            disparado_por=disparado_por,
            queue="long",
            timeout=14400
        )
        return {"success": True, "queued": True, "envio": envio.name}

    def _enviar(self, disparado_por="Manual"):
        """Background worker: send to all recipients with optional rate limiting."""
        from whatsapp_notifications.whatsapp_notifications.api import send_whatsapp, send_whatsapp_media
        from whatsapp_notifications.whatsapp_notifications.doctype.evolution_api_settings.evolution_api_settings import get_settings

        destinatarios = self.resolver_destinatarios()
        if not destinatarios:
            self.db_set("status", "Rascunho")
            frappe.db.commit()
            return

        # Rate limiting: read from Evolution API Settings
        settings = get_settings()
        rate_limit_on = settings.get("enable_rate_limiting")
        msgs_per_min = max(1, settings.get("messages_per_minute") or 20)
        # Base delay in seconds between messages (randomised ±25% to look human)
        delay_base = (60.0 / msgs_per_min) if rate_limit_on else 0

        enviados = 0
        falhados = 0
        has_attachment = bool(self.anexo)

        for i, dest in enumerate(destinatarios):
            # Apply delay before every message except the first
            if i > 0 and delay_base:
                time.sleep(delay_base * random.uniform(0.75, 1.25))

            contacto = dest.get("contacto", "").strip()
            if not contacto:
                falhados += 1
                continue
            try:
                mensagem = self._render_mensagem(dest)
                if has_attachment:
                    result = send_whatsapp_media(
                        phone=contacto,
                        doctype=self.doctype,
                        docname=self.name,
                        file_url=self.anexo,
                        caption=mensagem or "",
                        queue=False
                    )
                else:
                    result = send_whatsapp(
                        phone=contacto,
                        message=mensagem,
                        doctype=self.doctype,
                        docname=self.name,
                        queue=False
                    )
                if result and result.get("success"):
                    enviados += 1
                else:
                    falhados += 1
            except Exception as e:
                falhados += 1
                frappe.log_error(
                    message="{} -> {}".format(contacto, str(e)),
                    title="Aviso WhatsApp - Erro Envio"
                )

        self.registar_historico(
            enviados=enviados,
            falhados=falhados,
            total=len(destinatarios),
            disparado_por=disparado_por
        )

        # Determine next status
        proximo = self.calcular_proximo_envio(after_send=True)
        if proximo:
            novo_status = "Recorrente" if self.modo_recorrencia in ("Intervalo", "Datas") else "Agendado"
            self.db_set("proximo_envio", proximo)
            self.db_set("status", novo_status)
        else:
            new_status = "Enviado" if self.tipo_envio == "Agora" else "Concluído"
            self.db_set("status", new_status)

        frappe.db.commit()

    @frappe.whitelist()
    def agendar(self):
        """Validate schedule fields, calculate proximo_envio, set status."""
        if self.status not in ("Rascunho", "Pausado"):
            frappe.throw(_("Só é possível agendar quando o status é Rascunho ou Pausado."))

        if not self.fontes:
            frappe.throw(_("Adicione pelo menos uma fonte de destinatários."))
        if not self.mensagem and not self.anexo:
            frappe.throw(_("Escreva a mensagem ou anexe um ficheiro."))
        if not self.data_envio:
            frappe.throw(_("Indique a data de envio."))

        proximo = self.calcular_proximo_envio()
        if not proximo:
            frappe.throw(_("A data de envio é no passado. Indique uma data futura."))

        self.db_set("proximo_envio", proximo)
        if self.modo_recorrencia in ("Intervalo", "Datas"):
            self.db_set("status", "Recorrente")
        else:
            self.db_set("status", "Agendado")
        frappe.db.commit()
        return {"proximo_envio": str(proximo)}

    @frappe.whitelist()
    def pausar(self):
        """Pause a scheduled or recurring aviso."""
        if self.status not in ("Agendado", "Recorrente"):
            frappe.throw(_("Só é possível pausar avisos Agendados ou Recorrentes."))
        self.db_set("status", "Pausado")
        frappe.db.commit()

    @frappe.whitelist()
    def retomar(self):
        """Resume a paused aviso, recalculating proximo_envio."""
        if self.status != "Pausado":
            frappe.throw(_("Só é possível retomar avisos Pausados."))
        proximo = self.calcular_proximo_envio()
        if not proximo:
            frappe.throw(_("Não há datas futuras disponíveis para retomar o agendamento."))
        self.db_set("proximo_envio", proximo)
        if self.modo_recorrencia in ("Intervalo", "Datas"):
            self.db_set("status", "Recorrente")
        else:
            self.db_set("status", "Agendado")
        frappe.db.commit()
        return {"proximo_envio": str(proximo)}

    @frappe.whitelist()
    def cancelar(self):
        """Cancel scheduling, return to Rascunho."""
        self.db_set("status", "Rascunho")
        self.db_set("proximo_envio", None)
        frappe.db.commit()

    def resolver_destinatarios(self):
        """Iterate self.fontes, resolve each, deduplicate by phone."""
        seen_contacts = set()
        all_recipients = []
        for fonte in (self.fontes or []):
            resolved = self._resolver_fonte(fonte)
            for r in resolved:
                c = (r.get("contacto") or "").strip()
                if c and c not in seen_contacts:
                    seen_contacts.add(c)
                    all_recipients.append(r)
        return all_recipients

    def _resolver_fonte(self, fonte):
        """Dispatch resolution by tipo_fonte."""
        tipo = fonte.tipo_fonte
        recipients = []

        if tipo == "Catecumenos":
            filters = []
            if fonte.filtro_status:
                filters.append(["status", "=", fonte.filtro_status])
            for f in _build_extra_filters(fonte):
                filters.append(f)
            if fonte.nome_registo:
                records = [frappe.get_doc("Catecumeno", fonte.nome_registo)] if frappe.db.exists("Catecumeno", fonte.nome_registo) else []
            else:
                records = frappe.get_list("Catecumeno", filters=filters, fields=["name", "nome_completo", "nome", "contacto", "contacto_padrinhos"], limit_page_length=0)
            for r in records:
                nome = getattr(r, "nome_completo", None) or getattr(r, "nome", None) or r.name
                for num in parse_contacto(r.get("contacto") if isinstance(r, dict) else getattr(r, "contacto", None)):
                    recipients.append({"nome": nome, "contacto": num, "origem": "Catecumenos", "doc": r})
                if fonte.incluir_padrinhos:
                    for num in parse_contacto(r.get("contacto_padrinhos") if isinstance(r, dict) else getattr(r, "contacto_padrinhos", None)):
                        recipients.append({"nome": "Padrinho de " + nome, "contacto": num, "origem": "Catecumenos (Padrinho)", "doc": r})

        elif tipo == "Catequistas":
            filters = []
            if fonte.filtro_status:
                filters.append(["status", "=", fonte.filtro_status])
            for f in _build_extra_filters(fonte):
                filters.append(f)
            if fonte.nome_registo:
                records = [frappe.get_doc("Catequista", fonte.nome_registo)] if frappe.db.exists("Catequista", fonte.nome_registo) else []
            else:
                records = frappe.get_list("Catequista", filters=filters, fields=["name", "nome_completo", "nome", "contacto_1", "contacto_2"], limit_page_length=0)
            for r in records:
                nome = getattr(r, "nome_completo", None) or getattr(r, "nome", None) or (r.get("name") if isinstance(r, dict) else r.name)
                for field in ("contacto_1", "contacto_2"):
                    raw = r.get(field) if isinstance(r, dict) else getattr(r, field, None)
                    for num in parse_contacto(raw):
                        recipients.append({"nome": nome, "contacto": num, "origem": "Catequistas", "doc": r})

        elif tipo == "Turma":
            if fonte.nome_registo:
                turmas = [{"name": fonte.nome_registo}]
            else:
                filters = []
                if fonte.filtro_status:
                    filters.append(["status", "=", fonte.filtro_status])
                for f in _build_extra_filters(fonte):
                    filters.append(f)
                turmas = frappe.get_list("Turma", filters=filters, fields=["name"], limit_page_length=0)
            for t in turmas:
                try:
                    doc = frappe.get_doc("Turma", t.get("name") if isinstance(t, dict) else t.name)
                except frappe.DoesNotExistError:
                    continue
                for row in (doc.lista_catecumenos or []):
                    cat_link = getattr(row, "catecumeno", None)
                    raw_contacto = getattr(row, "contacto", None)
                    nome = cat_link or ""
                    if cat_link:
                        try:
                            cat_doc = frappe.get_doc("Catecumeno", cat_link)
                            if not raw_contacto:
                                raw_contacto = getattr(cat_doc, "contacto", None)
                            nome = getattr(cat_doc, "nome_completo", None) or getattr(cat_doc, "nome", None) or cat_link
                        except frappe.DoesNotExistError:
                            pass
                    for num in parse_contacto(raw_contacto):
                        recipients.append({"nome": nome, "contacto": num, "origem": "Turma", "doc": row})

        elif tipo == "Preparacao Sacramento":
            if fonte.nome_registo:
                preps = [{"name": fonte.nome_registo}]
            else:
                filters = []
                for f in _build_extra_filters(fonte):
                    filters.append(f)
                preps = frappe.get_list("Preparacao do Sacramento", filters=filters, fields=["name"], limit_page_length=0)
            for p in preps:
                try:
                    doc = frappe.get_doc("Preparacao do Sacramento", p.get("name") if isinstance(p, dict) else p.name)
                except frappe.DoesNotExistError:
                    continue
                for row in (doc.candidatos_sacramento_table or []):
                    raw_contacto = getattr(row, "contacto", None)
                    nome = getattr(row, "nome_completo", None) or getattr(row, "nome", None) or ""
                    raw_padrinhos = getattr(row, "contacto_padrinhos", None)
                    if not raw_contacto or not nome:
                        cat_link = getattr(row, "catecumeno", None)
                        if cat_link:
                            try:
                                cat_doc = frappe.get_doc("Catecumeno", cat_link)
                                if not raw_contacto:
                                    raw_contacto = getattr(cat_doc, "contacto", None)
                                if not raw_padrinhos:
                                    raw_padrinhos = getattr(cat_doc, "contacto_padrinhos", None)
                                nome = nome or getattr(cat_doc, "nome_completo", None) or getattr(cat_doc, "nome", None) or cat_link
                            except frappe.DoesNotExistError:
                                pass
                    for num in parse_contacto(raw_contacto):
                        recipients.append({"nome": nome, "contacto": num, "origem": "Prep. Sacramento", "doc": row})
                    if fonte.incluir_padrinhos:
                        for num in parse_contacto(raw_padrinhos):
                            recipients.append({"nome": "Padrinho de " + nome if nome else "Padrinho", "contacto": num, "origem": "Prep. Sacramento (Padrinho)", "doc": row})

        elif tipo == "DocType":
            if not fonte.doctype_fonte or not fonte.campo_contacto:
                return []
            try:
                filters = []
                for f in _build_extra_filters(fonte):
                    filters.append(f)
                if fonte.usar_child_table and fonte.child_table_field and fonte.campo_contacto_child:
                    # Get parent records
                    parents = frappe.get_list(fonte.doctype_fonte, filters=filters, fields=["name"], limit_page_length=0)
                    for parent in parents:
                        try:
                            doc = frappe.get_doc(fonte.doctype_fonte, parent.name)
                        except Exception:
                            continue
                        child_rows = getattr(doc, fonte.child_table_field, []) or []
                        for row in child_rows:
                            raw = getattr(row, fonte.campo_contacto_child, None)
                            for num in parse_contacto(raw):
                                recipients.append({"nome": parent.name, "contacto": num, "origem": fonte.doctype_fonte, "doc": row})
                else:
                    records = frappe.get_list(fonte.doctype_fonte, filters=filters, fields=["name", fonte.campo_contacto], limit_page_length=0)
                    for r in records:
                        raw = r.get(fonte.campo_contacto)
                        for num in parse_contacto(raw):
                            recipients.append({"nome": r.name, "contacto": num, "origem": fonte.doctype_fonte, "doc": r})
            except Exception as e:
                frappe.log_error(message=str(e), title="Aviso WhatsApp - Resolver DocType")

        elif tipo == "Numeros Manuais":
            raw = fonte.numeros or ""
            for line in raw.split("\n"):
                line = line.strip()
                if not line:
                    continue
                num_str, owner = _parse_numero_nome(line)
                if num_str is None:
                    continue
                # No name detected — check for legacy comma/semicolon-separated numbers
                if not owner and ("," in num_str or ";" in num_str):
                    for sub in num_str.replace(";", ",").split(","):
                        n = normalize_mz_number(sub.strip())
                        if n:
                            recipients.append({"nome": "", "contacto": n, "number_owner": "", "origem": "Manual", "doc": None})
                else:
                    n = normalize_mz_number(num_str)
                    if n:
                        recipients.append({"nome": owner, "contacto": n, "number_owner": owner, "origem": "Manual", "doc": None})

        elif tipo == "Grupo WhatsApp":
            if fonte.grupo_id:
                recipients.append({"nome": fonte.grupo_nome or fonte.grupo_id, "contacto": fonte.grupo_id, "origem": "Grupo WhatsApp", "doc": None})

        return recipients

    def _render_mensagem(self, dest):
        """Render message with Jinja2 template substitution when variables are present."""
        if not self.mensagem:
            return ""
        # Always render when the message contains template syntax,
        # regardless of the usar_template checkbox.
        if not self.usar_template and "{{" not in self.mensagem:
            return self.mensagem
        try:
            return _render_mensagem_para_dest(self.mensagem, dest)
        except Exception as e:
            frappe.log_error(message=str(e), title="Aviso WhatsApp - Render Template")
            return self.mensagem

    def calcular_proximo_envio(self, after_send=False):
        """Calculate the next send datetime based on recurrence mode."""
        now = now_datetime()

        if self.tipo_envio == "Agora":
            return None

        if self.modo_recorrencia == "Unico":
            if not self.data_envio:
                return None
            dt = get_datetime(self.data_envio)
            if dt > now:
                return dt
            return None

        elif self.modo_recorrencia == "Intervalo":
            if not self.intervalo_valor or not self.intervalo_tipo:
                return None
            base = get_datetime(self.ultimo_envio) if (after_send and self.ultimo_envio) else get_datetime(self.data_envio)
            if not base:
                return None
            if after_send:
                if self.intervalo_tipo == "dias":
                    next_dt = base + timedelta(days=self.intervalo_valor)
                elif self.intervalo_tipo == "semanas":
                    next_dt = base + timedelta(weeks=self.intervalo_valor)
                elif self.intervalo_tipo == "meses":
                    next_dt = base + relativedelta(months=self.intervalo_valor)
                else:
                    return None
            else:
                next_dt = base
            if self.data_fim and next_dt.date() > get_datetime(self.data_fim).date():
                return None
            if next_dt > now:
                return next_dt
            return None

        elif self.modo_recorrencia == "Datas":
            if not self.datas_especificas:
                return None
            try:
                datas = json.loads(self.datas_especificas)
            except Exception:
                return None
            future_dates = sorted([get_datetime(d) for d in datas if get_datetime(d) > now])
            if future_dates:
                return future_dates[0]
            return None

        return None

    def registar_historico(self, enviados, falhados, total, disparado_por="Manual"):
        """Append a historico row and update aggregate counters."""
        self.reload()
        self.append("historico", {
            "data_envio_real": now_datetime(),
            "total": total,
            "enviados": enviados,
            "falhados": falhados,
            "disparado_por": disparado_por
        })
        self.db_set("total_enviados", (self.total_enviados or 0) + enviados)
        self.db_set("total_falhados", (self.total_falhados or 0) + falhados)
        self.db_set("ultimo_envio", now_datetime())
        self.save(ignore_permissions=True)
        frappe.db.commit()
