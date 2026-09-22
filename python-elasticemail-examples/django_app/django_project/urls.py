from django.urls import path

from elasticemail_app import views

urlpatterns = [
    path("health", views.health, name="health"),
    path("send", views.send_email, name="send_email"),
    path("webhook", views.webhook, name="webhook"),
    path("inbound", views.inbound, name="inbound"),
    path("double-optin/subscribe", views.double_optin_subscribe, name="double_optin_subscribe"),
    path("double-optin/confirm", views.double_optin_confirm, name="double_optin_confirm"),
    path("double-optin/webhook", views.double_optin_webhook, name="double_optin_webhook"),
]
