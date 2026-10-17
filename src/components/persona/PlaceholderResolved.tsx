import { createContext, useContext, type ReactNode } from 'react';

import {
  isResolvablePlaceholder,
  placeholderHint,
  SHARED_PLACEHOLDER_TOKENS,
} from '@/components/persona/placeholderTokens';
import {
  displayPlaceholderValue,
  groupPersonaFills,
  placeholderFollowsTier,
  type PersonaFill,
} from '@/components/persona/placeholderPreview';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { personaApi, type PersonaPlaceholderPreview, type PlaceholderPreviewData } from '@/lib/api';

type PreviewFrame = {
  preview: PlaceholderPreviewData | null | undefined;
  groupName: string;
  answerContractDraft: string | undefined;
};

const PreviewFrameContext = createContext<PreviewFrame | null>(null);

export function PlaceholderPreviewProvider({
  preview,
  groupName,
  answerContractDraft,
  children,
}: PreviewFrame & { children: ReactNode }) {
  return (
    <PreviewFrameContext.Provider value={{ preview, groupName, answerContractDraft }}>
      {children}
    </PreviewFrameContext.Provider>
  );
}

const SHARED = new Set<string>(SHARED_PLACEHOLDER_TOKENS);

type HintRow = {
  id: string;
  text: string;
  personaNames?: string[];
};

function PersonaHintIcon({ name }: { name: string }) {
  return (
    <Avatar aria-hidden className="h-4 w-4 ring-2 ring-primary/40">
      <AvatarImage src={personaApi.getAvatarUrl(name)} alt="" className="object-cover" />
      <AvatarFallback className="text-[9px] leading-none">{name.slice(0, 1)}</AvatarFallback>
    </Avatar>
  );
}

function personaFill(
  token: string,
  persona: PersonaPlaceholderPreview,
  frame: PreviewFrame,
  blank: string,
  follows: string,
  usesGroup: (name: string) => string,
  sep: string,
): PersonaFill {
  const value =
    displayPlaceholderValue(token, persona, frame.groupName, frame.answerContractDraft) || blank;
  const notes: string[] = [];
  if (persona.prompt_group !== frame.groupName) notes.push(usesGroup(persona.prompt_group));
  if (placeholderFollowsTier(token, persona)) notes.push(follows);
  return { name: persona.name, value, notes: notes.join(sep) };
}

/** 标签悬停：说明在上，填入值在下。相同的填入值合成一行。 */
export function PlaceholderHintBody({ token }: { token: string }) {
  const frame = useContext(PreviewFrameContext);
  const { t } = useLanguage();
  const preview = frame?.preview;
  const rows: HintRow[] = [];
  if (frame && isResolvablePlaceholder(token)) {
    if (preview === undefined) {
      rows.push({ id: 'loading', text: t('personaConfig.placeholderResolvedLoading') });
    } else if (preview === null) {
      rows.push({ id: 'missed', text: t('personaConfig.placeholderResolvedMissed') });
    } else if (SHARED.has(token)) {
      rows.push({
        id: token,
        text: preview.shared[token] || t('personaConfig.placeholderResolvedBlank'),
      });
    } else if (preview.personas.length === 0) {
      rows.push({ id: 'empty', text: t('personaConfig.placeholderResolvedEmpty') });
    } else {
      const fills = preview.personas.map((persona) =>
        personaFill(
          token,
          persona,
          frame,
          t('personaConfig.placeholderResolvedBlank'),
          t('personaConfig.placeholderResolvedFollows'),
          (name) => t('personaConfig.placeholderResolvedUsesGroup', { name }),
          t('personaConfig.placeholderResolvedNoteSep'),
        ),
      );
      const nameSep = t('personaConfig.activePromptGroupSep');
      for (const group of groupPersonaFills(fills)) {
        const line = t('personaConfig.placeholderResolvedPersona', {
          name: group.names.join(nameSep),
          value: group.value,
        });
        const text = group.notes
          ? t('personaConfig.placeholderResolvedNoted', { line, notes: group.notes })
          : line;
        rows.push({
          id: `${group.names.join('\0')}\0${group.value}\0${group.notes}`,
          personaNames: group.names,
          text,
        });
      }
    }
  }
  return (
    <div className="space-y-1.5 text-left">
      <p className="whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
        {placeholderHint(token)}
      </p>
      {rows.map((row) => {
        const status = row.id === 'loading' || row.id === 'missed' || row.id === 'empty';
        if (status) {
          return (
            <p
              key={row.id}
              className="whitespace-pre-wrap break-words text-xs text-muted-foreground"
            >
              {row.text}
            </p>
          );
        }
        return (
          <p
            key={row.id}
            className="flex items-start gap-1.5 whitespace-pre-wrap break-words rounded-md bg-muted px-2 py-1 text-sm text-foreground"
          >
            {row.personaNames && row.personaNames.length > 0 ? (
              <span className="mt-0.5 flex shrink-0 gap-1">
                {row.personaNames.map((name) => (
                  <PersonaHintIcon key={name} name={name} />
                ))}
              </span>
            ) : null}
            <span className="min-w-0">{row.text}</span>
          </p>
        );
      })}
    </div>
  );
}
