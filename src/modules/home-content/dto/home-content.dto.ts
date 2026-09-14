import { IsObject } from 'class-validator';

export class UpdateHomeContentDto {
  /**
   * The whole home page document. Section shape is owned by the storefront,
   * which merges this over its built-in defaults, so the API stores it as-is
   * rather than duplicating (and drifting from) that schema.
   */
  @IsObject()
  content!: Record<string, unknown>;
}
