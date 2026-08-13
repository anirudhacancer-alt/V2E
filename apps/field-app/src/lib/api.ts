/**
 * API client for V2E backend
 */

import { Capacitor, CapacitorHttp } from "@capacitor/core";

const IS_DEV = import.meta.env.DEV;
const IS_NATIVE_SHELL = Capacitor.isNativePlatform();
const API_BASE_URL =
	(import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
	(IS_DEV ? "http://localhost:3000" : "");
const API_TOKEN =
	(import.meta.env.VITE_API_TOKEN as string | undefined)?.trim() ||
	(IS_DEV ? "dev-token" : "");

async function fileToBase64(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	let binary = "";
	const chunkSize = 0x8000;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		const chunk = bytes.subarray(index, index + chunkSize);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}

class ApiClient {
	private baseUrl: string;
	private apiToken: string;

	constructor(baseUrl: string = API_BASE_URL) {
		this.baseUrl = baseUrl;
		this.apiToken = API_TOKEN;
	}

	private assertBaseUrl(path: string) {
		if (this.baseUrl) return;
		if (IS_NATIVE_SHELL) {
			throw new Error(
				`VITE_API_URL must be configured for native mobile builds before calling ${path}.`,
			);
		}
	}

	private buildHeaders(options?: {
		headers?: HeadersInit;
		includeJsonContentType?: boolean;
		includeAuth?: boolean;
	}): Headers {
		const headers = new Headers(options?.headers);

		if (options?.includeJsonContentType && !headers.has("Content-Type")) {
			headers.set("Content-Type", "application/json");
		}

		if (options?.includeAuth) {
			if (!this.apiToken) {
				throw new Error(
					"VITE_API_TOKEN must be configured for authenticated requests outside local development.",
				);
			}
			headers.set("Authorization", `Bearer ${this.apiToken}`);
		}

		return headers;
	}

	private headersToObject(headers: Headers): Record<string, string> {
		return Object.fromEntries(headers.entries());
	}

	async fetch<T>(
		path: string,
		options?: RequestInit,
		includeAuth = false,
	): Promise<T> {
		const method = (options?.method ?? "GET").toUpperCase();
		const body = options?.body;
		// Avoid Content-Type on GET/HEAD — it triggers an unnecessary CORS preflight.
		const includeJsonContentType =
			method !== "GET" &&
			method !== "HEAD" &&
			body != null &&
			!(body instanceof FormData) &&
			typeof body === "string";
		const headers = this.buildHeaders({
			headers: options?.headers,
			includeJsonContentType,
			includeAuth,
		});
		const url = `${this.baseUrl}${path}`;

		try {
			this.assertBaseUrl(path);
			console.log("[api] request", {
				method,
				url,
				includeAuth,
				isNativeShell: IS_NATIVE_SHELL,
				transport:
					IS_NATIVE_SHELL && !(body instanceof FormData)
						? "capacitor-http"
						: "fetch",
			});
			if (IS_NATIVE_SHELL && !(body instanceof FormData)) {
				const nativeResponse = await CapacitorHttp.request({
					url,
					method,
					headers: this.headersToObject(headers),
					data:
						typeof body === "string" && includeJsonContentType
							? JSON.parse(body)
							: undefined,
					responseType: "json",
				});
				if (nativeResponse.status < 200 || nativeResponse.status >= 300) {
					console.error("[api] non-ok response", {
						method,
						url,
						status: nativeResponse.status,
					});
					const errorData =
						typeof nativeResponse.data === "object" && nativeResponse.data !== null
							? nativeResponse.data
							: { error: { message: `HTTP ${nativeResponse.status}` } };
					throw new Error(
						(errorData as { error?: { message?: string } }).error?.message ||
							`HTTP ${nativeResponse.status}`,
					);
				}
				console.log("[api] response ok", {
					method,
					url,
					status: nativeResponse.status,
				});
				return nativeResponse.data as T;
			}

			const response = await fetch(url, {
				...options,
				headers,
			});
			if (!response.ok) {
				console.error("[api] non-ok response", {
					method,
					url,
					status: response.status,
				});
				const error = await response.json().catch(() => ({
					error: { code: "UNKNOWN", message: `HTTP ${response.status}` },
				}));
				throw new Error(error.error?.message || `HTTP ${response.status}`);
			}

			console.log("[api] response ok", {
				method,
				url,
				status: response.status,
			});
			return response.json();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error("[api] request failed before response", {
				method,
				url,
				message: msg,
			});
			throw new Error(
				`Cannot reach API at ${this.baseUrl}. Is the V2E API running? (${msg})`,
			);
		}
	}

	// Projects
	async getProjects() {
		return this.fetch<{
			items: Array<{
				id: string;
				code: string;
				name: string;
				siteName: string;
				siteSupervisorId?: string | null;
				siteSupervisorName?: string | null;
				siteSupervisorEmail?: string | null;
				siteSupervisorRole?: string | null;
				siteManagerId?: string | null;
				siteManagerName?: string | null;
				siteManagerEmail?: string | null;
				siteManagerRole?: string | null;
				isActive: boolean;
				taskCount: number;
				openTaskCount: number;
			}>;
		}>("/v1/projects");
	}

	/** Active project locations (`locationId` for updates / tasks). Flat `GET /v1/locations?projectId=&isActive=true`. */
	async getProjectLocations(projectId: string) {
		const q = new URLSearchParams({
			projectId,
			isActive: "true",
		});
		const res = await this.fetch<{
			data: Array<{ id: string; displayLabel: string; listLabel: string }>;
			total: number;
		}>(`/v1/locations?${q.toString()}`);
		return {
			items: res.data.map((loc) => ({
				id: loc.id,
				displayLabel: loc.displayLabel,
				listLabel: loc.listLabel,
			})),
		};
	}

	// Dashboard
	async getDashboard(projectId: string) {
		return this.fetch<{
			projectId: string;
			projectName: string;
			tasksByStatus: { active: number; blocked: number; done: number };
			tasksBlockedToday?: number;
			tasksBySeverity: {
				critical: number;
				high: number;
				medium: number;
				low: number;
			};
			overdueCount: number;
			recentUpdatesCount: number;
			reviewQueueCount?: number;
			upcomingStandupDate: string | null;
			lastUpdatedAt: string;
		}>(`/v1/dashboard?projectId=${projectId}`);
	}

	// Tasks
	async getTasks(
		projectId: string,
		params?: {
			page?: number;
			pageSize?: number;
			status?: string;
			severity?: string;
			department?: string;
			overdueOnly?: boolean;
		},
	) {
		const searchParams = new URLSearchParams();
		searchParams.set("projectId", projectId);
		if (params?.page) searchParams.set("page", String(params.page));
		if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
		if (params?.status) searchParams.set("status", params.status);
		if (params?.severity) searchParams.set("severity", params.severity);
		if (params?.department) searchParams.set("department", params.department);
		if (params?.overdueOnly) searchParams.set("overdueOnly", "true");

		const query = searchParams.toString();
		return this.fetch<{
			items: Array<{
				id: string;
				title: string;
				severity: string;
				departmentCode?: string | null;
				owner: string;
				ownerId: string;
				assigneeRoleCode: string;
				assigneeRoleName: string;
				location: string;
				locationList: string;
				dueDate: string;
				status: string;
				isOverdue: boolean;
				dueSummary: string;
				openDays: number;
				source?: string;
				sourceUpdateId?: string | null;
				updatedAt: string;
			}>;
			pagination: {
				page: number;
				pageSize: number;
				total: number;
				totalPages: number;
			};
			filters: Record<string, unknown>;
		}>(`/v1/tasks${query ? `?${query}` : ""}`);
	}

	async getTask(taskId: string) {
		return this.fetch<{
			id: string;
			title: string;
			description: string;
			severity: string;
			departmentCode?: string | null;
			createdBy?: string | null;
			updatedBy?: string | null;
			owner: string;
			ownerId: string;
			assigneeRoleCode: string;
			assigneeRoleName: string;
			location: string;
			locationId: string;
			dueDate: string;
			startDate: string;
			status: string;
			source: string;
			sourceUpdateId: string | null;
			completedAt: string | null;
			isOverdue: boolean;
			createdAt: string;
			updatedAt: string;
		}>(`/v1/tasks/${taskId}`);
	}

	async updateTaskStatus(
		taskId: string,
		status: "In-progress" | "Blocked" | "Done",
	) {
		return this.fetch<{
			id: string;
			title: string;
			description: string;
			severity: string;
			departmentCode: string | null;
			owner: string;
			ownerId: string;
			assigneeRoleCode: string;
			assigneeRoleName: string;
			location: string;
			locationId: string;
			dueDate: string;
			startDate: string;
			status: string;
			source: string;
			sourceUpdateId: string | null;
			completedAt: string | null;
			isOverdue: boolean;
			createdBy: string | null;
			updatedBy: string | null;
			createdAt: string;
			updatedAt: string;
		}>(
			`/v1/tasks/${taskId}`,
			{
				method: "PATCH",
				body: JSON.stringify({ status }),
			},
			true,
		);
	}

	// Updates
	async getUpdates(
		projectId: string,
		params?: {
			page?: number;
			pageSize?: number;
			/** Legacy raw DB status filter */
			status?: string;
			/** Product note queue: Review | Linked | Escalated */
			noteState?: "Review" | "Linked" | "Escalated";
			/** Inclusive window on `updatedAt` (all-queue mode; omit `noteState` / legacy `status`) */
			updatedAfter?: string;
			updatedBefore?: string;
		},
	) {
		const searchParams = new URLSearchParams();
		if (params?.page) searchParams.set("page", String(params.page));
		if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
		if (params?.status) searchParams.set("status", params.status);
		if (params?.noteState) searchParams.set("noteState", params.noteState);
		if (params?.updatedAfter)
			searchParams.set("updatedAfter", params.updatedAfter);
		if (params?.updatedBefore)
			searchParams.set("updatedBefore", params.updatedBefore);

		searchParams.set("projectId", projectId);
		const query = searchParams.toString();

		return this.fetch<{
			items: Array<{
				id: string;
				transcript: string;
				category: string | null;
				location: string | null;
				severity: string | null;
				status: string;
				noteState: "Review" | "Linked" | "Escalated";
				recordedByName: string;
				recordedByRole: string;
				hasAudio: boolean;
				hasAttachments: boolean;
				attachmentCount: number;
				createdAt: string;
				updatedAt: string;
				isUnread: boolean;
				blockerSubtype: string | null;
				locationHierarchy: string | undefined;
				locationList: string;
				linkedTaskId: string | null;
				linkedTaskTitle: string | null;
				linkedTaskStatus: string | null;
				reviewPrompt: string | null;
				reviewReasons: string[];
				nextActionHint: string;
			}>;
			pagination: {
				page: number;
				pageSize: number;
				total: number;
				totalPages: number;
			};
		}>(`/v1/updates?${query}`);
	}

	// Standup Prep
	async getStandupPrep(projectId: string) {
		return this.fetch<{
			projectId: string;
			projectName: string;
			date: string;
			yesterdayCompleted: Array<{
				id: string;
				description: string;
				location: string | null;
				linkedTaskId?: string | null;
				ownerName: string;
			}>;
			carryForwardDueYesterday: Array<{
				id: string;
				taskTitle: string;
				description: string;
				severity: string;
				location?: string | null;
				ownerName: string;
			}>;
			plannedItems: Array<{
				id: string;
				description: string;
				location: string | null;
				department?: string | null;
				linkedTaskId?: string | null;
				ownerName: string;
			}>;
			activeBlockers: Array<{
				taskId: string;
				taskTitle: string;
				severity: string;
				location: string | null;
				reason: string;
				ownerName: string;
			}>;
			expectedAttendees: Array<{
				teamMemberId: string;
				name: string;
				orgRoleCode: string;
				roleTypeName: string;
			}>;
			stats: {
				tasksActive: number;
				tasksBlocked: number;
				tasksCompleted: number;
				overdueCount: number;
			};
			lastStandup: {
				id: string;
				date: string;
				summaryText: string | null;
				modelUsed?: string;
			} | null;
		}>(`/v1/standup-prep?projectId=${projectId}`);
	}

	/** Pilot KPI snapshot (read-only). */
	async getPilotMetrics(projectId: string) {
		return this.fetch<{
			projectId: string;
			generatedAt: string;
			tasksTotal: number;
			tasksFromVoice: number;
			updatesTotal: number;
			updatesWithAiOutput: number;
			standupsTotal: number;
			auditEventsLast24h: number;
		}>(`/v1/metrics/pilot?projectId=${projectId}`);
	}

	// Get single update with AI output
	async getUpdate(updateId: string, projectId: string) {
		return this.fetch<{
			id: string;
			siteId: string;
			projectId: string;
			locationId: string;
			transcript: string;
			audioUrl: string | null;
			audioDuration: number | null;
			category: string | null;
			location: string | null;
			severity: string | null;
			departmentCode: string | null;
			status: string;
			recordedBy: string;
			recordedByName: string;
			isRead: boolean;
			readAt: string | null;
			hasAudio: boolean;
			hasAttachments: boolean;
			attachmentCount: number;
			attachments?: Array<{ id: string; url: string; type: string }>;
			createdAt: string;
			updatedAt: string;
			sourceTaskId?: string | null;
			aiOutput: {
				category: string;
				departmentCode: string | null;
				location: string | null;
				blockerSubtype: string | null;
				locationBlock: string | null;
				locationZone: string | null;
				locationLevel: string | null;
				locationArea: string | null;
				vendor: string | null;
				severity: string;
				assigneeRoleCode: string;
				assigneeRoleName: string;
				ownerId: string | null;
				dueDate: string;
				generatedTaskDescription: string;
				riskImpact: string;
				scheduleRisk: string;
				confidence: number;
				downstreamEffects: string[];
				recommendedActions: string[];
				reviewRequirement?: {
					required: boolean;
					reasons: string[];
					fields: string[];
					prompt?: string | null;
				};
				reviewedAt?: string | null;
				reviewedBy?: string | null;
				lowConfidenceThreshold?: number;
			} | null;
		}>(`/v1/updates/${updateId}?${new URLSearchParams({ projectId }).toString()}`);
	}

	// Create Update with optional audio upload (multipart form)
	async createUpdate(
		projectId: string,
		formData: FormData,
	): Promise<{
		id: string;
		siteId: string;
		projectId: string;
		recordedBy: string;
		transcript: string;
		audioUrl: string | null;
		audioDuration: number | null;
		status: string;
		hasAttachments?: boolean;
		attachmentCount?: number;
		createdAt: string;
		updatedAt: string;
	}> {
		// Add projectId to formData for flat route
		formData.append("projectId", projectId);
		const response = await fetch(
			`${this.baseUrl}/v1/updates`,
			{
				method: "POST",
				body: formData,
				headers: this.buildHeaders({ includeAuth: true }),
				// Don't set Content-Type header - browser will set it with boundary for multipart
			},
		);

		if (!response.ok) {
			const error = await response.json().catch(() => ({
				error: { code: "UNKNOWN", message: `HTTP ${response.status}` },
			}));
			throw new Error(error.error?.message || `HTTP ${response.status}`);
		}

		return response.json();
	}

	/** Add a photo to an existing update via unified `POST /v1/attachments`. */
	async uploadUpdateImage(_projectId: string, updateId: string, file: File) {
		if (IS_NATIVE_SHELL) {
			const headers = this.buildHeaders({
				includeJsonContentType: true,
				includeAuth: true,
			});
			const response = await CapacitorHttp.request({
				url: `${this.baseUrl}/v1/attachments`,
				method: "POST",
				headers: this.headersToObject(headers),
				data: {
					parentType: "update",
					parentId: updateId,
					fileName: file.name,
					mimeType: file.type,
					base64Data: await fileToBase64(file),
				},
				responseType: "json",
			});

			if (response.status < 200 || response.status >= 300) {
				const error =
					typeof response.data === "object" && response.data !== null
						? response.data
						: { error: { message: `HTTP ${response.status}` } };
				throw new Error(
					(error as { error?: { message?: string } }).error?.message ||
						`HTTP ${response.status}`,
				);
			}

			return response.data as {
				id: string;
				parentType: "update";
				parentId: string;
				url: string;
				type: string;
				uploadedAt: string;
			};
		}

		const formData = new FormData();
		formData.append("image", file);
		formData.append("parentType", "update");
		formData.append("parentId", updateId);
		const response = await fetch(
			`${this.baseUrl}/v1/attachments`,
			{
				method: "POST",
				body: formData,
				headers: this.buildHeaders({ includeAuth: true }),
			},
		);

		if (!response.ok) {
			const error = await response.json().catch(() => ({
				error: { code: "UNKNOWN", message: `HTTP ${response.status}` },
			}));
			throw new Error(error.error?.message || `HTTP ${response.status}`);
		}

		return response.json() as Promise<{
			id: string;
			parentType: "update";
			parentId: string;
			url: string;
			type: string;
			uploadedAt: string;
		}>;
	}

	/** Mark update as escalated (supervisor / PM follow-up). */
	async escalateUpdate(updateId: string, projectId: string) {
		return this.fetch<{
			updateId: string;
			status: string;
			updatedAt: string;
			alreadyEscalated?: boolean;
		}>(
			`/v1/updates/${updateId}/escalate`,
			{
				method: "POST",
				body: JSON.stringify({ projectId }),
			},
			true,
		);
	}

	// Trigger Transcription on an update
	async triggerTranscription(updateId: string, projectId: string) {
		return this.fetch<{
			updateId: string;
			transcript: string;
			language: string;
			duration: number;
			modelUsed: string;
			processingTimeMs: number;
			idempotentReplay?: boolean;
		}>(
			`/v1/updates/${updateId}/transcribe`,
			{
				method: "POST",
				body: JSON.stringify({ projectId }),
			},
			true,
		);
	}

	// Update transcript (inline editing)
	async updateTranscript(
		updateId: string,
		transcript: string,
		projectId: string,
	) {
		return this.fetch<{
			id: string;
			transcript: string;
			updatedAt: string;
			isRead: boolean;
			readAt: string | null;
		}>(
			`/v1/updates/${updateId}`,
			{
				method: "PATCH",
				body: JSON.stringify({ projectId, transcript }),
			},
			true,
		);
	}

	/** Mark update as read (supervisor opened review / detail). */
	async markUpdateRead(updateId: string, projectId: string) {
		return this.fetch<{
			id: string;
			transcript: string;
			updatedAt: string;
			isRead: boolean;
			readAt: string | null;
		}>(
			`/v1/updates/${updateId}`,
			{
				method: "PATCH",
				body: JSON.stringify({ projectId, markAsRead: true }),
			},
			true,
		);
	}

	/** Correct canonical location on an update (and AI output row when present). */
	async patchUpdateLocation(
		updateId: string,
		projectId: string,
		locationId: string,
	) {
		return this.fetch<{
			id: string;
			transcript: string;
			updatedAt: string;
			isRead: boolean;
			readAt: string | null;
			locationId: string;
		}>(
			`/v1/updates/${updateId}`,
			{
				method: "PATCH",
				body: JSON.stringify({ projectId, locationId }),
			},
			true,
		);
	}

	// Trigger AI extraction on an update
	async extractUpdate(updateId: string, projectId: string) {
		return this.fetch<{
			updateId: string;
			aiOutput: {
				extractedInfo: {
					category: string;
					department: string | null;
					location: string | null;
					vendor: string | null;
					severity: string;
				};
				suggestedAssignment: {
					ownerRole: string;
					ownerId: string | null;
					dueDate: string;
				};
				generatedTaskDescription: string;
				riskAssessment: {
					impact: string;
					scheduleRisk: string;
					downstreamEffects: string[];
					recommendedActions: string[];
				};
				confidence: number;
				reviewRequirement: {
					required: boolean;
					reasons: string[];
					fields: string[];
					prompt?: string | null;
				};
			};
			modelUsed: string;
			processingTimeMs: number;
			version: string;
			reviewRequirement?: {
				required: boolean;
				reasons: string[];
				fields: string[];
				prompt?: string | null;
			};
			idempotentReplay?: boolean;
			autoTaskOutcome?:
				| { kind: "skipped"; reason: string }
				| { kind: "created"; taskId: string; band: "medium" | "high" };
		}>(
			`/v1/ai/voice-note-extraction`,
			{
				method: "POST",
				body: JSON.stringify({ projectId, updateId }),
			},
			true,
		);
	}

	/** Confirm the structured AI review request on an update. */
	async confirmUpdateReview(
		updateId: string,
		projectId: string,
		reviewedBy?: string,
	) {
		return this.fetch<{
			updateId: string;
			reviewedAt: string;
			reviewedBy: string | null;
		}>(
			`/v1/updates/${updateId}/confirm-review`,
			{
				method: "POST",
				body: JSON.stringify(
					reviewedBy
						? { projectId, reviewedBy }
						: { projectId },
				),
			},
			true,
		);
	}

	/** Generate AI standup summary from task-derived prep; response is on-demand and not persisted. */
	async generateStandupSummary(projectId: string) {
		return this.fetch<{
			projectId: string;
			summaryText: string;
			modelUsed: string;
			processingTimeMs: number;
		}>(`/v1/ai/standup-summary`, {
			method: "POST",
			body: JSON.stringify({ projectId }),
		}, true);
	}

	// Create task from extraction
	async createTask(
		projectId: string,
		data: {
			title: string;
			description: string;
			severity: string;
			departmentCode: string;
			locationId: string;
			ownerId: string;
			assigneeRoleCode: string;
			dueDate: string;
			sourceUpdateId?: string;
		},
	) {
		return this.fetch<{
			id: string;
			projectId: string;
			siteId: string;
			title: string;
			description: string;
			severity: string;
			departmentCode: string;
			location: string;
			locationId: string;
			ownerId: string;
			ownerName: string;
			assigneeRoleCode: string;
			assigneeRoleName: string;
			status: string;
			source: string;
			sourceUpdateId: string | null;
			startDate: string;
			dueDate: string;
			createdAt: string;
		}>(
			`/v1/tasks`,
			{
				method: "POST",
				body: JSON.stringify({ ...data, projectId }),
			},
			true,
		);
	}

	// Get members for a project (for owner selection).
	async getMembers(projectId: string) {
		const q = new URLSearchParams({ projectId });
		return this.fetch<{
			items: Array<{
				id: string;
				name: string;
				orgRoleCode: string;
				roleTypeName: string;
				email: string | null;
				isActive: boolean;
			}>;
		}>(`/v1/members?${q.toString()}`);
	}
}

export const api = new ApiClient();
