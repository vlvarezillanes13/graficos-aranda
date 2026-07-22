import {
  buildAdditionalFieldsUrl,
  buildGroupListUrl,
  buildGroupSpecialistsUrl,
  buildItemUrl,
} from './itsmApi.js'
import { itsmFetch } from './itsmFetch.js'

type ItemPayload = Record<string, unknown>
type AdditionalFieldPayload = Record<string, unknown>

export interface ItemAssignContext {
  id: number
  itemType: number
  modelId: number
  stateId: number
  categoryId: number
  serviceId: number
  projectId: number
  applicantId: number
  companyId: number
  customerId: number
  locationId: number
  reasonId: number
  registryTypeId: number
}

async function readUpstreamError(
  response: Response,
  fallback: string,
): Promise<string> {
  const body = await response.text()
  if (!body.trim()) return `${fallback} (${response.status})`

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    const message =
      parsed.message ??
      parsed.error ??
      parsed.Message ??
      parsed.ErrorMessage

    if (typeof message === 'string' && message.trim()) {
      return message.trim()
    }
  } catch {
    // Keep plain-text body below.
  }

  return body.trim()
}

function unwrapRecord(payload: unknown): ItemPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Respuesta inválida del ticket en ITSM')
  }

  const record = payload as Record<string, unknown>
  if (record.content && typeof record.content === 'object' && !Array.isArray(record.content)) {
    return record.content as ItemPayload
  }

  return record
}

function parseAdditionalFields(payload: unknown): AdditionalFieldPayload[] {
  if (Array.isArray(payload)) {
    return payload as AdditionalFieldPayload[]
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { content?: unknown[] }).content)
  ) {
    return (payload as { content: AdditionalFieldPayload[] }).content
  }

  return []
}

function pickString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function pickNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback
}

function pickNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null
}

function pickBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeAdditionalFields(
  fields: AdditionalFieldPayload[],
  itemId: number,
): AdditionalFieldPayload[] {
  return fields.map((field) => ({
    ...field,
    itemId: pickNumber(field.itemId, itemId),
  }))
}

function buildUpdatePayload(
  item: ItemPayload,
  listAdditionalField: AdditionalFieldPayload[],
  context: ItemAssignContext,
  groupId: number,
  responsibleId: number,
): ItemPayload {
  return {
    applicantId: pickNumber(item.applicantId, context.applicantId),
    categoryId: pickNumber(item.categoryId, context.categoryId),
    cause: pickString(item.cause),
    ciId: pickNumber(item.ciId, 0),
    commentary: pickString(item.commentary),
    companyId: pickNumber(item.companyId, context.companyId),
    consoleType: 'specialist',
    constructionInitialDate: item.constructionInitialDate ?? null,
    constructionFinalDate: item.constructionFinalDate ?? null,
    constructionDuration: item.constructionDuration ?? null,
    contractId: pickNullableNumber(item.contractId),
    correctActions: pickString(item.correctActions),
    currentTime: pickNumber(item.currentTime, 0),
    customerId: pickNumber(item.customerId, context.customerId),
    description: pickString(item.description, pickString(item.descriptionNoHtml)),
    estimatedCost: pickNumber(item.estimatedCost, 0),
    estimatedTime: pickNumber(item.estimatedTime, 0),
    foregroundColorRgb: pickString(item.foregroundColorRgb),
    followUpActions: pickString(item.followUpActions),
    groupId,
    hasMoreInformation: pickBoolean(item.hasMoreInformation),
    hasPendingSurvey: pickBoolean(item.hasPendingSurvey ?? item.hasSurvey),
    impactId: pickNumber(item.impactId),
    incorrectActions: pickString(item.incorrectActions),
    instalationInitialDate: item.instalationInitialDate ?? null,
    instalationFinalDate: item.instalationFinalDate ?? null,
    instalationDuration: item.instalationDuration ?? null,
    instance: pickNumber(item.instance, pickNumber(item.modifiedDate, Date.now())),
    isFeeAvailable: pickBoolean(item.isFeeAvailable, true),
    itemType: pickNumber(item.itemType, context.itemType),
    itemVersion: pickNumber(item.itemVersion, 1),
    knownError: item.knownError ?? null,
    locationId: pickNumber(item.locationId, context.locationId),
    majorProblem: item.majorProblem ?? null,
    modelId: pickNumber(item.modelId, context.modelId),
    olaId: pickNumber(item.olaId, 0),
    priorityId: pickNumber(item.priorityId),
    priorityReason: pickString(item.priorityReason),
    projectId: pickNumber(item.projectId, context.projectId),
    providerId: pickNumber(item.providerId, 0),
    psoInitialDate: item.psoInitialDate ?? null,
    psoFinalDate: item.psoFinalDate ?? null,
    psoDuration: item.psoDuration ?? null,
    realCost: pickNumber(item.realCost, 0),
    reasonId: pickNumber(item.reasonId, context.reasonId),
    recomendations: pickString(item.recomendations),
    registryTypeId: pickNumber(item.registryTypeId, context.registryTypeId),
    responsibleId,
    scheduledStateDate: item.scheduledStateDate ?? null,
    serviceId: pickNumber(item.serviceId, context.serviceId),
    stateId: pickNumber(item.stateId, context.stateId),
    subject: pickString(item.subject),
    surveyToken: pickString(item.surveyToken),
    testInitialDate: item.testInitialDate ?? null,
    testFinalDate: item.testFinalDate ?? null,
    testDuration: item.testDuration ?? null,
    thirdParty: pickBoolean(item.thirdParty),
    transformed: pickBoolean(item.transformed),
    ucId: pickNumber(item.ucId, 0),
    unitId: pickNullableNumber(item.unitId) ?? 0,
    urgencyId: pickNumber(item.urgencyId),
    listAdditionalField,
    validate: true,
  }
}

export async function fetchItsmItem(itemId: string): Promise<ItemPayload> {
  const response = await itsmFetch(buildItemUrl(itemId), {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(
      await readUpstreamError(response, 'No se pudo obtener el ticket'),
    )
  }

  return unwrapRecord(await response.json())
}

async function fetchItsmAdditionalFields(
  context: ItemAssignContext,
): Promise<AdditionalFieldPayload[]> {
  const response = await itsmFetch(buildAdditionalFieldsUrl(), {
    method: 'POST',
    body: JSON.stringify({
      asdkWeb: true,
      categoryId: context.categoryId,
      consoleType: 'specialist',
      id: context.id,
      itemType: context.itemType,
      modelId: context.modelId,
      serviceId: context.serviceId,
      stateId: context.stateId,
    }),
  })

  if (!response.ok) {
    throw new Error(
      await readUpstreamError(
        response,
        'No se pudieron obtener los campos adicionales del ticket',
      ),
    )
  }

  return parseAdditionalFields(await response.json())
}

export async function updateItsmItem(
  itemId: string,
  payload: ItemPayload,
): Promise<Response> {
  return itsmFetch(buildItemUrl(itemId), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function assignItemResponsible(
  itemId: string,
  groupId: number,
  responsibleId: number,
  context: ItemAssignContext,
): Promise<void> {
  const [item, additionalFields] = await Promise.all([
    fetchItsmItem(itemId),
    fetchItsmAdditionalFields(context),
  ])

  const listAdditionalField = normalizeAdditionalFields(
    additionalFields,
    context.id,
  )

  if (listAdditionalField.length === 0) {
    throw new Error(
      'El ticket no devolvió campos adicionales; no es posible actualizarlo de forma segura.',
    )
  }

  const payload = buildUpdatePayload(
    item,
    listAdditionalField,
    context,
    groupId,
    responsibleId,
  )

  const response = await updateItsmItem(itemId, payload)

  if (!response.ok) {
    throw new Error(
      await readUpstreamError(response, 'No se pudo actualizar el responsable'),
    )
  }
}

export async function fetchItsmGroups(
  serviceId: number,
  stateId: number,
): Promise<Response> {
  return itsmFetch(buildGroupListUrl(serviceId, stateId), {
    method: 'GET',
  })
}

export async function fetchItsmGroupSpecialists(
  groupId: number,
  projectId: number,
): Promise<Response> {
  return itsmFetch(buildGroupSpecialistsUrl(groupId, projectId), {
    method: 'GET',
  })
}
