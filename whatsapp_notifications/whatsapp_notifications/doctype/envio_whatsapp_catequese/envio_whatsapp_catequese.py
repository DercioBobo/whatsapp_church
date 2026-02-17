# Copyright (c) 2024, Entretech and contributors
# For license information, please see license.txt

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


class EnvioWhatsAppCatequese(Document):
    def validate(self):
        self.total_destinatarios = len(self.destinatarios) if self.destinatarios else 0

    @frappe.whitelist()
    def adicionar_destinatarios(self):
        """Resolve recipients from the selected source and add to the child table."""
        if self.status != "Rascunho":
            frappe.throw(_("Só é possível adicionar destinatários quando o status é Rascunho"))

        if not self.tipo_destinatario:
            frappe.throw(_("Seleccione o tipo de destinatário"))

        # Collect existing contacts for deduplication
        existing_contacts = set()
        for row in self.destinatarios or []:
            if row.contacto:
                existing_contacts.add(row.contacto.strip())

        new_recipients = []

        if self.tipo_destinatario == "Manual":
            new_recipients = self._resolve_manual()
        elif self.tipo_destinatario == "Catecumeno":
            new_recipients = self._resolve_catecumeno()
        elif self.tipo_destinatario == "Catequista":
            new_recipients = self._resolve_catequista()
        elif self.tipo_destinatario == "Turma":
            new_recipients = self._resolve_turma()
        elif self.tipo_destinatario == "Preparacao do Sacramento":
            new_recipients = self._resolve_preparacao()

        added = 0
        for r in new_recipients:
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

        return {"added": added, "total": self.total_destinatarios}

    def _resolve_manual(self):
        """Parse manually entered phone numbers."""
        if not self.numeros_manuais:
            frappe.throw(_("Introduza os números manuais"))
        # Split on commas, newlines, and slashes
        raw = self.numeros_manuais.replace(",", "\n").replace("/", "\n")
        recipients = []
        for line in raw.split("\n"):
            number = line.strip()
            if number:
                recipients.append({
                    "nome": "",
                    "contacto": number,
                    "origem": "Manual",
                    "referencia": ""
                })
        return recipients

    def _resolve_catecumeno(self):
        """Get contact(s) from a single Catecumeno."""
        if not self.catecumeno:
            frappe.throw(_("Seleccione um Catecumeno"))
        doc = frappe.get_doc("Catecumeno", self.catecumeno)
        raw_contacto = getattr(doc, "contacto", None)
        if not raw_contacto:
            frappe.throw(_("O Catecumeno {0} não tem contacto definido").format(self.catecumeno))
        nome = getattr(doc, "nome_completo", None) or getattr(doc, "nome", None) or self.catecumeno
        numbers = parse_contacto(raw_contacto)
        return [{
            "nome": nome,
            "contacto": num,
            "origem": "Catecumeno",
            "referencia": self.catecumeno
        } for num in numbers]

    def _resolve_catequista(self):
        """Get contact(s) from a single Catequista."""
        if not self.catequista:
            frappe.throw(_("Seleccione um Catequista"))
        doc = frappe.get_doc("Catequista", self.catequista)
        raw_contacto = getattr(doc, "contacto", None)
        if not raw_contacto:
            frappe.throw(_("O Catequista {0} não tem contacto definido").format(self.catequista))
        nome = getattr(doc, "nome_completo", None) or getattr(doc, "nome", None) or self.catequista
        numbers = parse_contacto(raw_contacto)
        return [{
            "nome": nome,
            "contacto": num,
            "origem": "Catequista",
            "referencia": self.catequista
        } for num in numbers]

    def _resolve_turma(self):
        """Get contacts from all catecumenos in a Turma."""
        if not self.turma:
            frappe.throw(_("Seleccione uma Turma"))
        doc = frappe.get_doc("Turma", self.turma)
        recipients = []
        child_table = getattr(doc, "lista_catecumenos", None) or []
        if not child_table:
            frappe.throw(_("A Turma {0} não tem catecumenos").format(self.turma))
        for row in child_table:
            raw_contacto = getattr(row, "contacto", None)
            nome = getattr(row, "nome_completo", None) or getattr(row, "nome", None) or ""
            # If the child row has a link to Catecumeno but no direct contacto, fetch it
            if not raw_contacto:
                catecumeno_link = getattr(row, "catecumeno", None)
                if catecumeno_link:
                    cat_doc = frappe.get_doc("Catecumeno", catecumeno_link)
                    raw_contacto = getattr(cat_doc, "contacto", None)
                    nome = nome or getattr(cat_doc, "nome_completo", None) or getattr(cat_doc, "nome", None) or catecumeno_link
            for num in parse_contacto(raw_contacto):
                recipients.append({
                    "nome": nome,
                    "contacto": num,
                    "origem": "Turma",
                    "referencia": self.turma
                })
        if not recipients:
            frappe.msgprint(_("Nenhum contacto encontrado na Turma {0}").format(self.turma))
        return recipients

    def _resolve_preparacao(self):
        """Get contacts from all candidates in a Preparacao do Sacramento."""
        if not self.preparacao_sacramento:
            frappe.throw(_("Seleccione uma Preparação do Sacramento"))
        doc = frappe.get_doc("Preparacao do Sacramento", self.preparacao_sacramento)
        recipients = []
        child_table = getattr(doc, "candidatos_sacramento_table", None) or []
        if not child_table:
            frappe.throw(
                _("A Preparação do Sacramento {0} não tem candidatos").format(self.preparacao_sacramento)
            )
        for row in child_table:
            raw_contacto = getattr(row, "contacto", None)
            nome = getattr(row, "nome_completo", None) or getattr(row, "nome", None) or ""
            # If the child row has a link to Catecumeno but no direct contacto, fetch it
            if not raw_contacto:
                catecumeno_link = getattr(row, "catecumeno", None)
                if catecumeno_link:
                    cat_doc = frappe.get_doc("Catecumeno", catecumeno_link)
                    raw_contacto = getattr(cat_doc, "contacto", None)
                    nome = nome or getattr(cat_doc, "nome_completo", None) or getattr(cat_doc, "nome", None) or catecumeno_link
            for num in parse_contacto(raw_contacto):
                recipients.append({
                    "nome": nome,
                    "contacto": num,
                    "origem": "Preparacao do Sacramento",
                    "referencia": self.preparacao_sacramento
                })
        if not recipients:
            frappe.msgprint(
                _("Nenhum contacto encontrado na Preparação {0}").format(self.preparacao_sacramento)
            )
        return recipients

    @frappe.whitelist()
    def enviar_mensagens(self):
        """Send the WhatsApp message to all recipients in the child table."""
        if self.status != "Rascunho":
            frappe.throw(_("As mensagens já foram enviadas ou estão em envio"))

        if not self.destinatarios:
            frappe.throw(_("Adicione pelo menos um destinatário"))

        if not self.mensagem:
            frappe.throw(_("Escreva a mensagem"))

        from whatsapp_notifications.whatsapp_notifications.api import send_whatsapp

        self.db_set("status", "Enviando")
        frappe.db.commit()

        enviados = 0
        falhados = 0

        for row in self.destinatarios:
            try:
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
