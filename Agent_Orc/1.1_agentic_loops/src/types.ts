// types.ts — shapes shared by the loop, the tools and the checks

/** What a tool function hands back to the loop, before it becomes a tool_result block. */
export interface ToolOutput {
  content: string;
  /** Sent as tool_result.is_error, so Claude sees the failure and can try again. */
  isError: boolean;
}

/** One executed tool_use block: what Claude asked for and what our code returned. */
export interface ToolCall {
  /** Loop iteration whose response contained the tool_use block. */
  iteration: number;
  /** tool_use.id; the matching tool_result must carry it as tool_use_id. */
  id: string;
  name: string;
  input: unknown;
  output: string;
  isError: boolean;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

/** What the loop returns once Claude stops with stop_reason "end_turn". */
export interface LoopResult {
  /** Text blocks of the final response, joined. */
  text: string;
  /** Model calls made, the final end_turn call included. */
  iterations: number;
  toolCalls: ToolCall[];
  usage: Usage;
}
