#!/bin/bash
# =====================================================================
# Kampeki Finance — Liberar no macOS
# ---------------------------------------------------------------------
# Roda os comandos que fazem o macOS aceitar o app quando ele é bloqueado
# como "malware" (falso positivo por não ter assinatura paga da Apple):
#   1) remove a "quarentena" (etiqueta de arquivo baixado);
#   2) re-assina o app localmente (ad-hoc);
#   3) abre o app.
#
# COMO USAR: dê um duplo clique neste arquivo. Na 1ª vez, se o macOS
# reclamar, clique com o botão direito -> Abrir -> Abrir. Vai pedir sua
# senha do Mac (é normal — é para re-assinar o app).
# =====================================================================

APP="/Applications/Kampeki Finance.app"

echo ""
echo "  Kampeki Finance — liberando o app no seu Mac..."
echo ""

if [ ! -d "$APP" ]; then
  echo "  ✗ Não encontrei o app em:"
  echo "    $APP"
  echo ""
  echo "  Instale o Kampeki Finance primeiro (arraste-o para a pasta"
  echo "  Aplicativos a partir do .dmg). Se ele foi para o Lixo, recupere-o"
  echo "  (botão direito -> Colocar de volta) e rode este arquivo de novo."
  echo ""
  read -n 1 -s -r -p "  Pressione qualquer tecla para fechar."
  exit 1
fi

echo "  1/3 Removendo a quarentena..."
sudo xattr -dr com.apple.quarantine "$APP"

echo "  2/3 Re-assinando o app (ad-hoc)..."
sudo codesign --force --deep --sign - "$APP"

echo "  3/3 Abrindo o Kampeki Finance..."
open "$APP"

echo ""
echo "  ✓ Pronto! Se o app abriu, está tudo certo."
echo "    (Se você atualizar o app um dia e o bloqueio voltar, é só rodar"
echo "     este arquivo de novo.)"
echo ""
read -n 1 -s -r -p "  Pressione qualquer tecla para fechar."
