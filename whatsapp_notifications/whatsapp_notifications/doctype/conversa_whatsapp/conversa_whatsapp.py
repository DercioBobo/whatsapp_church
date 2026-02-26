# Copyright (c) 2026, Entretech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class ConversaWhatsApp(Document):

    @frappe.whitelist()
    def enviar(self, mensagem, usar_template=0, anexo=None):
        """Send a message to all resolved recipients and record in historico."""
        if not mensagem and not anexo:
            frappe.throw(_("Escreva a mensagem ou anexe um ficheiro."))

        from whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp import (
            resolver_fontes_list,
            _render_mensagem_para_dest,
        )
        from whatsapp_notifications.whatsapp_notifications.api import (
            send_whatsapp,
            send_whatsapp_media,
        )

        usar_template = frappe.utils.cint(usar_template)
        destinatarios = resolver_fontes_list(self.fontes)

        if not destinatarios:
            frappe.throw(_("Nenhum destinatário encontrado nas fontes configuradas."))

        enviados = 0
        falhados = 0
        has_attachment = bool(anexo)

        for dest in destinatarios:
            contacto = (dest.get("contacto") or "").strip()
            if not contacto:
                falhados += 1
                continue
            try:
                if usar_template or "{{" in (mensagem or ""):
                    msg = _render_mensagem_para_dest(mensagem, dest)
                else:
                    msg = mensagem or ""

                if has_attachment:
                    result = send_whatsapp_media(
                        phone=contacto,
                        doctype=self.doctype,
                        docname=self.name,
                        file_url=anexo,
                        caption=msg or "",
                        queue=False,
                    )
                else:
                    result = send_whatsapp(
                        phone=contacto,
                        message=msg,
                        doctype=self.doctype,
                        docname=self.name,
                        queue=False,
                    )

                if result and result.get("success"):
                    enviados += 1
                else:
                    falhados += 1
            except Exception as e:
                falhados += 1
                frappe.log_error(
                    message="{} -> {}".format(contacto, str(e)),
                    title="Conversa WhatsApp - Erro Envio",
                )

        # Append historico row
        self.reload()
        self.append("historico", {
            "data_envio": now_datetime(),
            "mensagem": mensagem or "",
            "tem_anexo": 1 if has_attachment else 0,
            "total": len(destinatarios),
            "enviados": enviados,
            "falhados": falhados,
            "enviado_por": frappe.session.user,
        })

        if not self.primeiro_envio:
            self.db_set("primeiro_envio", now_datetime())

        self.db_set("ultimo_envio", now_datetime())
        self.save(ignore_permissions=True)
        frappe.db.commit()

        return {
            "success": True,
            "enviados": enviados,
            "falhados": falhados,
            "total": len(destinatarios),
        }

    @frappe.whitelist()
    def arquivar(self):
        """Archive this conversation."""
        self.db_set("status", "Arquivada")
        frappe.db.commit()

    @frappe.whitelist()
    def reativar(self):
        """Reactivate an archived conversation."""
        self.db_set("status", "Ativa")
        frappe.db.commit()
