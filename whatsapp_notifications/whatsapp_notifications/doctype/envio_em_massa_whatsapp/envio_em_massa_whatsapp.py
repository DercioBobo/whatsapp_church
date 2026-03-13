import frappe
from frappe.model.document import Document


class EnvioEmMassaWhatsApp(Document):

    @frappe.whitelist()
    def retomar(self):
        if self.status not in ("Em Execução", "Interrompido", "Falhado"):
            frappe.throw("Só é possível retomar envios Interrompidos ou Em Execução.")
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
