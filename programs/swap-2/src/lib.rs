use anchor_lang::prelude::*;

declare_id!("CvnhLUPvpUo5gWfURBBR787G9xNVuoia4mZ67MpMhjmh");

#[program]
pub mod swap_2 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
