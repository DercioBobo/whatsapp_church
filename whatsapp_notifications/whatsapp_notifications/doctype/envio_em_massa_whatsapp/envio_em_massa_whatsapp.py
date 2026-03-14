import frappe
from frappe.model.document import Document


class EnvioemMassaWhatsApp(Document):

    @frappe.whitelist()
    def parar(self):
        if self.status != "Em Execução":
            frappe.throw("Só é possível parar um envio Em Execução.")
        frappe.db.set_value("Envio em Massa WhatsApp", self.name, {
            "parar_solicitado": 1,
            "status": "Parando"
        })
        frappe.db.commit()
        return {"ok": True}

    @frappe.whitelist()
    def cancelar(self):
        if self.status not in ("Em Execução", "Parando", "Interrompido"):
            frappe.throw("Só é possível cancelar envios Em Execução, Parando ou Interrompidos.")
        # Signal background job to stop
        frappe.db.set_value("Envio em Massa WhatsApp", self.name, {
            "parar_solicitado": 1,
            "status": "Cancelado",
            "pendentes": 0,
            "concluido_em": frappe.utils.now_datetime()
        })
        # Mark all remaining pending logs as Cancelado
        frappe.db.sql(
            "UPDATE `tabEnvio em Massa Log` SET status='Cancelado' WHERE envio=%s AND status='Pendente'",
            self.name
        )
        # Free the Aviso immediately
        if self.aviso:
            aviso_status = frappe.db.get_value("Aviso WhatsApp", self.aviso, "status")
            if aviso_status == "Enviando":
                frappe.db.set_value("Aviso WhatsApp", self.aviso, "status", "Rascunho")
        frappe.db.commit()
        return {"ok": True}

    @frappe.whitelist()
    def retomar(self):
        if self.status not in ("Em Execução", "Parando", "Interrompido", "Falhado"):
            frappe.throw("Só é possível retomar envios Interrompidos, Parando ou Em Execução.")
        # Check there are still pending logs
        pending_count = frappe.db.count(
            "Envio em Massa Log",
            filters={"envio": self.name, "status": "Pendente"}
        )
        if pending_count == 0:
            frappe.throw("Não há destinatários pendentes para retomar.")
        self.db_set("status", "Em Execução")
        frappe.db.commit()
        frappe.enqueue(
            "whatsapp_notifications.whatsapp_notifications.doctype.aviso_whatsapp.aviso_whatsapp._enviar_em_massa",
            envio_name=self.name,
            aviso_name=self.aviso,
            queue="long",
            timeout=14400
        )
        return {"queued": True, "pendentes": pending_count}


@frappe.whitelist()
def retomar_envio(envio_name):
    """Whitelist function to retomar from monitor page."""
    doc = frappe.get_doc("Envio em Massa WhatsApp", envio_name)
    return doc.retomar()
