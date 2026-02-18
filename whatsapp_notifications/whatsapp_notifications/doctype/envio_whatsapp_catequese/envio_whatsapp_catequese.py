# Copyright (c) 2024, Entretech and contributors
# For license information, please see license.txt

import json
import frappe
from frappe import _
from frappe.model.document import Document


def parse_contacto(raw):
    """Split a contacto string like '862872288 / 852872288' into individual numbers.

    Handles formats:
      - '822872285'              -> ['822872285']
      - '862872288 / 852872288'  -> ['862872288', '852872288']
      - '862872288/852872285'    -> ['862872288', '852872285']
    """
    if not raw:
        return []
    parts = raw.split("/")
    numbers = []
    for p in parts:
        n = p.strip()
        if n:
            numbers.append(n)
    return numbers


def _resolve_single_doc(doctype, name, origem):
    """Resolve contacts from a single Catecumeno or Catequista record."""
    try:
        doc = frappe.get_doc(doctype, name)
    except frappe.DoesNotExistError:
        return []
    raw_contacto = getattr(doc, "contacto", None)
    if not raw_contacto:
        return []
    nome = getattr(doc, "nome_completo", None) or getattr(doc, "nome", None) or name
    return [{
        "nome": nome,
        "contacto": num,
        "origem": origem,
        "referencia": name
    } for num in parse_contacto(raw_contacto)]


def _resolve_turma_doc(name):
    """Resolve contacts from all catecumenos in a Turma."""
    try:
        doc = frappe.get_doc("Turma", name)
    except frappe.DoesNotExistError:
        return []
    recipients = []
    child_table = getattr(doc, "lista_catecumenos", None) or []
    for row in child_table:
        raw_contacto = getattr(row, "contacto", None)
        nome = getattr(row, "nome_completo", None) or getattr(row, "nome", None) or ""
        if not raw_contacto:
            catecumeno_link = getattr(row, "catecumeno", None)
            if catecumeno_link:
                try:
                    cat_doc = frappe.get_doc("Catecumeno", catecumeno_link)
                    raw_contacto = getattr(cat_doc, "contacto", None)
                    nome = nome or getattr(cat_doc, "nome_completo", None) or getattr(cat_doc, "nome", None) or catecumeno_link
                except frappe.DoesNotExistError:
                    pass
        for num in parse_contacto(raw_contacto):
            recipients.append({
                "nome": nome,
                "contacto": num,
                "origem": "Turma",
                "referencia": name
            })
    return recipients


def _resolve_preparacao_doc(name):
    """Resolve contacts from all candidates in a Preparacao do Sacramento."""
    try:
        doc = frappe.get_doc("Preparacao do Sacramento", name)
    except frappe.DoesNotExistError:
        return []
    recipients = []
    child_table = getattr(doc, "candidatos_sacramento_table", None) or []
    for row in child_table:
        raw_contacto = getattr(row, "contacto", None)
        nome = getattr(row, "nome_completo", None) or getattr(row, "nome", None) or ""
        if not raw_contacto:
            catecumeno_link = getattr(row, "catecumeno", None)
            if catecumeno_link:
                try:
                    cat_doc = frappe.get_doc("Catecumeno", catecumeno_link)
                    raw_contacto = getattr(cat_doc, "contacto", None)
                    nome = nome or getattr(cat_doc, "nome_completo", None) or getattr(cat_doc, "nome", None) or catecumeno_link
                except frappe.DoesNotExistError:
                    pass
        for num in parse_contacto(raw_contacto):
            recipients.append({
                "nome": nome,
                "contacto": num,
                "origem": "Preparacao do Sacramento",
                "referencia": name
            })
    return recipients


class EnvioWhatsAppCatequese(Document):
    def validate(self):
        self.total_destinatarios = len(self.destinatarios) if self.destinatarios else 0

    @frappe.whitelist()
    def limpar_destinatarios(self):
        """Remove all recipients from the child table."""
        if self.status != "Rascunho":
            frappe.throw(_("Só é possível limpar destinatários quando o status é Rascunho"))

        self.destinatarios = []
        self.total_destinatarios = 0
        self.save()
        return {"success": True}

    @frappe.whitelist()
    def adicionar_multiplos(self, tipo, nomes):
        """Add recipients from multiple records in a single call.

        Args:
            tipo: 'Catecumeno', 'Catequista', 'Turma', 'Preparacao do Sacramento', or 'Manual'
            nomes: JSON list of record names, or raw text for Manual
        """
        if self.status != "Rascunho":
            frappe.throw(_("Só é possível adicionar destinatários quando o status é Rascunho"))

        if isinstance(nomes, str):
            nomes = json.loads(nomes)

        # Collect existing contacts for deduplication
        existing_contacts = set()
        for row in self.destinatarios or []:
            if row.contacto:
                existing_contacts.add(row.contacto.strip())

        all_recipients = []
        skipped = 0

        if tipo == "Manual":
            raw = (nomes[0] if nomes else "").replace(",", "\n").replace("/", "\n")
            for line in raw.split("\n"):
                number = line.strip()
                if number:
                    all_recipients.append({
                        "nome": "",
                        "contacto": number,
                        "origem": "Manual",
                        "referencia": ""
                    })
        elif tipo == "Catecumeno":
            for name in nomes:
                resolved = _resolve_single_doc("Catecumeno", name, "Catecumeno")
                if resolved:
                    all_recipients.extend(resolved)
                else:
                    skipped += 1
        elif tipo == "Catequista":
            for name in nomes:
                resolved = _resolve_single_doc("Catequista", name, "Catequista")
                if resolved:
                    all_recipients.extend(resolved)
                else:
                    skipped += 1
        elif tipo == "Turma":
            for name in nomes:
                resolved = _resolve_turma_doc(name)
                if resolved:
                    all_recipients.extend(resolved)
                else:
                    skipped += 1
        elif tipo == "Preparacao do Sacramento":
            for name in nomes:
                resolved = _resolve_preparacao_doc(name)
                if resolved:
                    all_recipients.extend(resolved)
                else:
                    skipped += 1
        elif tipo == "Grupo":
            for item in nomes:
                if isinstance(item, dict):
                    group_id = item.get("id", "")
                    group_name = item.get("subject", group_id)
                else:
                    group_id = str(item)
                    group_name = group_id
                if group_id:
                    all_recipients.append({
                        "nome": group_name,
                        "contacto": group_id,
                        "origem": "Grupo",
                        "referencia": group_name
                    })

        added = 0
        for r in all_recipients:
            contact = (r.get("contacto") or "").strip()
            if not contact:
                continue
            if contact in existing_contacts:
                continue
            existing_contacts.add(contact)
            self.append("destinatarios", {
                "nome": r.get("nome", ""),
                "contacto": contact,
                "origem": r.get("origem", ""),
                "referencia": r.get("referencia", ""),
                "status_envio": "Pendente"
            })
            added += 1

        self.total_destinatarios = len(self.destinatarios)
        self.save()

        return {"added": added, "total": self.total_destinatarios, "skipped": skipped}

    @frappe.whitelist()
    def enviar_mensagens(self):
        """Send the WhatsApp message to all recipients in the child table."""
        if self.status != "Rascunho":
            frappe.throw(_("As mensagens já foram enviadas ou estão em envio"))

        if not self.destinatarios:
            frappe.throw(_("Adicione pelo menos um destinatário"))

        if not self.mensagem and not self.anexo:
            frappe.throw(_("Escreva a mensagem ou anexe um ficheiro"))

        from whatsapp_notifications.whatsapp_notifications.api import send_whatsapp, send_whatsapp_media

        has_attachment = bool(self.anexo)

        self.db_set("status", "Enviando")
        frappe.db.commit()

        enviados = 0
        falhados = 0

        for row in self.destinatarios:
            try:
                if has_attachment:
                    result = send_whatsapp_media(
                        phone=row.contacto,
                        doctype=self.doctype,
                        docname=self.name,
                        file_url=self.anexo,
                        caption=self.mensagem or "",
                        queue=False
                    )
                else:
                    result = send_whatsapp(
                        phone=row.contacto,
                        message=self.mensagem,
                        doctype=self.doctype,
                        docname=self.name,
                        queue=False
                    )
                if result and result.get("success"):
                    row.db_set("status_envio", "Enviado")
                    enviados += 1
                else:
                    error_msg = result.get("error", "Erro desconhecido") if result else "Sem resposta"
                    row.db_set("status_envio", "Falhou")
                    row.db_set("erro", str(error_msg))
                    falhados += 1
            except Exception as e:
                row.db_set("status_envio", "Falhou")
                row.db_set("erro", str(e))
                falhados += 1
                frappe.log_error(
                    message="{} -> {}".format(row.contacto, str(e)),
                    title="Envio WhatsApp Catequese Error"
                )

        # Update counters and status
        self.db_set("total_enviados", enviados)
        self.db_set("total_falhados", falhados)
        self.db_set("total_destinatarios", len(self.destinatarios))

        if falhados == 0:
            self.db_set("status", "Enviado")
        elif enviados == 0:
            self.db_set("status", "Falhou")
        else:
            self.db_set("status", "Enviado Parcialmente")

        frappe.db.commit()

        return {
            "enviados": enviados,
            "falhados": falhados,
            "total": len(self.destinatarios)
        }
