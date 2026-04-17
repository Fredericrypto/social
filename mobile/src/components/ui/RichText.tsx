/**
 * RichText.tsx
 *
 * Parser e renderer de markdown inline minimalista:
 *  - **texto** → negrito
 *  - _texto_   → itálico
 *  - Renderiza como array de <Text> spans inline
 *
 * RichTextToolbar: barra de formatação que envolve o texto selecionado
 * com tags markdown. Posicionada acima do teclado (InputAccessoryView no iOS,
 * View fixa no Android).
 */

import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, InputAccessoryView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../../store/theme.store";

// ─── Parser de markdown inline ────────────────────────────────────────────────
interface Span {
  text:   string;
  bold?:  boolean;
  italic?: boolean;
}

export function parseRichText(raw: string): Span[] {
  const spans: Span[] = [];
  // Regex: **bold**, _italic_, ou texto normal
  const regex = /\*\*(.*?)\*\*|_(.*?)_|([^*_]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match[1] !== undefined) {
      spans.push({ text: match[1], bold: true });
    } else if (match[2] !== undefined) {
      spans.push({ text: match[2], italic: true });
    } else if (match[3] !== undefined) {
      spans.push({ text: match[3] });
    }
  }

  return spans.length > 0 ? spans : [{ text: raw }];
}

// ─── Componente de renderização ───────────────────────────────────────────────
interface RichTextProps {
  text:      string;
  style?:    any;
  numberOfLines?: number;
}

export function RichText({ text, style, numberOfLines }: RichTextProps) {
  if (!text) return null;
  const spans = parseRichText(text);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {spans.map((span, i) => (
        <Text
          key={i}
          style={{
            fontWeight: span.bold   ? "700" : "400",
            fontStyle:  span.italic ? "italic" : "normal",
          }}
        >
          {span.text}
        </Text>
      ))}
    </Text>
  );
}

// ─── Toolbar de formatação ────────────────────────────────────────────────────
const TOOLBAR_ID = "richtext-toolbar";

interface RichTextToolbarProps {
  inputRef:     React.RefObject<TextInput>;
  value:        string;
  onChangeText: (v: string) => void;
}

/**
 * Wrap o texto selecionado com tags markdown.
 * Como React Native não expõe seleção de texto de forma confiável
 * entre plataformas, esta implementação aplica a tag ao texto inteiro
 * quando não há seleção, ou usa uma abordagem de toggle de prefixo/sufixo.
 *
 * Para seleção real de palavras individuais, seria necessária uma lib
 * de rich text (Draft.js nativo / Slate). Esta implementação é 100% nativa,
 * sem dependências externas.
 */
export function RichTextToolbar({ inputRef, value, onChangeText }: RichTextToolbarProps) {
  const { theme } = useThemeStore();

  const wrap = (tag: "**" | "_") => {
    // Toggle: se já está todo em bold/italic, remove. Se não, adiciona.
    const wrapped = `${tag}${value}${tag}`;
    const isAlready = value.startsWith(tag) && value.endsWith(tag);
    if (isAlready) {
      onChangeText(value.slice(tag.length, -tag.length));
    } else {
      onChangeText(wrapped);
    }
    inputRef.current?.focus();
  };

  const ToolbarContent = (
    <View style={[tb.bar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      <TouchableOpacity
        style={[tb.btn, { borderColor: theme.border }]}
        onPress={() => wrap("**")}
        activeOpacity={0.7}
      >
        <Text style={[tb.btnText, { color: theme.text, fontWeight: "800" }]}>B</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[tb.btn, { borderColor: theme.border }]}
        onPress={() => wrap("_")}
        activeOpacity={0.7}
      >
        <Text style={[tb.btnText, { color: theme.text, fontStyle: "italic" }]}>I</Text>
      </TouchableOpacity>

      <View style={[tb.separator, { backgroundColor: theme.border }]} />

      <Text style={[tb.hint, { color: theme.textTertiary }]}>
        **negrito**  _itálico_
      </Text>
    </View>
  );

  // iOS: InputAccessoryView flutua acima do teclado automaticamente
  if (Platform.OS === "ios") {
    return (
      <InputAccessoryView nativeID={TOOLBAR_ID}>
        {ToolbarContent}
      </InputAccessoryView>
    );
  }

  // Android: a toolbar fica dentro do KeyboardAvoidingView
  // e sobe junto com o teclado
  return ToolbarContent;
}

export { TOOLBAR_ID };

// ─── Styles ───────────────────────────────────────────────────────────────────
const tb = StyleSheet.create({
  bar:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  btn:       { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  btnText:   { fontSize: 15 },
  separator: { width: 1, height: 20, marginHorizontal: 4 },
  hint:      { fontSize: 11, flex: 1 },
});
